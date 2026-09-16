import "server-only";

import { prisma } from "@/lib/db";
import { canEdit } from "@/lib/enums";
import { PLANTILLA_CONCEPTO } from "@/lib/gimi";
import { getProjectRole } from "@/lib/projects";
import { AgentApiError } from "@/lib/agentApi";
import type { SessionUser } from "@/lib/auth";

/**
 * La etapa Convergir por la puerta del agente.
 *
 * Mismas reglas que la pantalla. Un concepto nace de ideas de Combinar —una o
 * varias, de uno o varios insights, que es como se escala una solucion— y las
 * ideas tienen que ser de ESTE proyecto. Uno que cite una idea ajena o
 * inexistente se rechaza entero, igual que un insight que cita un punto que
 * no esta en el mapa.
 *
 * El agente NO puntua por iniciativa propia. La matriz Impacto × Fit es un
 * ejercicio del equipo (CV.pdf: evaluar, intercambiar el ranking con un par,
 * votar si hay empate). Un agente que llega con los seis numeros puestos le
 * quita al equipo justo la discusion que la etapa existe para provocar. Si el
 * equipo se lo pide, puntua, y deja escrito el porque de cada numero para que
 * haya contra que discutirlo.
 */

export type IncomingConcept = {
  titulo: string;
  /** Que es, en una frase. */
  enunciado: string;
  /** Los cinco elementos de la plantilla del GIMI (CB.pdf, lamina 44). */
  quienTieneElProblema?: string | null;
  necesidades?: string | null;
  solucion?: string | null;
  quienLaOfrece?: string | null;
  comoLoResuelve?: string | null;
  /** El punto caliente del mapa del que parte. */
  ancla?: string | null;
  /** Ids de InsightIdea. */
  ideas: string[];
  supuestos?: { texto: string; probabilidad?: number }[];
};

function normalizar(t: string) {
  return t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Compone la descripcion con los cinco elementos rotulados, en el orden de la plantilla. */
function describir(c: IncomingConcept): string {
  const valores: Record<string, string | null | undefined> = {
    quienTieneElProblema: c.quienTieneElProblema,
    necesidades: c.necesidades,
    solucion: c.solucion,
    quienLaOfrece: c.quienLaOfrece,
    comoLoResuelve: c.comoLoResuelve,
  };
  const partes = PLANTILLA_CONCEPTO.map((e) => {
    const v = (valores[e.campo] ?? "").trim();
    return v ? `${e.pregunta}\n${v}` : null;
  }).filter(Boolean);
  if (c.ancla?.trim()) partes.unshift(`Ancla en el mapa\n${c.ancla.trim()}`);
  return partes.join("\n\n");
}

export async function createConcepts(
  user: SessionUser,
  slug: string,
  items: IncomingConcept[],
  estado: "PROPOSED" | "ACCEPTED" = "PROPOSED",
) {
  const project = await prisma.project.findUnique({ where: { slug }, select: { id: true } });
  if (!project) throw new AgentApiError(`No existe el proyecto "${slug}".`, 404);
  const access = await getProjectRole(user, project.id);
  if (!access) throw new AgentApiError("El proyecto no existe.", 404);
  if (!canEdit(access.role)) {
    throw new AgentApiError("El token no tiene permiso de escritura en este proyecto.", 403);
  }

  const ideas = await prisma.insightIdea.findMany({
    where: { insight: { projectId: project.id } },
    select: { id: true, text: true, insightId: true },
  });
  const porId = new Map(ideas.map((i) => [i.id, i]));

  const existentes = await prisma.concept.findMany({
    where: { projectId: project.id },
    select: { title: true },
  });
  const yaEscritos = new Set(existentes.map((e) => normalizar(e.title)));

  const ultimo = await prisma.concept.findFirst({
    where: { projectId: project.id },
    orderBy: { position: "desc" },
    select: { position: true },
  });
  let posicion = (ultimo?.position ?? -1) + 1;

  const creados: { id: string; titulo: string }[] = [];
  const rechazados: { titulo: string; motivo: string }[] = [];

  for (const item of items) {
    const titulo = (item.titulo ?? "").trim();
    const enunciado = (item.enunciado ?? "").trim();

    if (!titulo || enunciado.length < 20) {
      rechazados.push({ titulo, motivo: "Hace falta el nombre y un enunciado de al menos una frase." });
      continue;
    }
    if (yaEscritos.has(normalizar(titulo))) {
      rechazados.push({ titulo, motivo: "Ya existe un concepto con ese nombre." });
      continue;
    }

    const unicas = [...new Set(item.ideas ?? [])];
    if (unicas.length === 0) {
      rechazados.push({
        titulo,
        motivo: "Un concepto sale de al menos una idea de Combinar. Sin ideas no hay de donde rastrearlo.",
      });
      continue;
    }
    const ajenas = unicas.filter((id) => !porId.has(id));
    if (ajenas.length > 0) {
      rechazados.push({
        titulo,
        motivo: `Estas ideas no existen en este proyecto: ${ajenas.join(", ")}. Los ids salen de leer_proyecto con insights en detalle completo.`,
      });
      continue;
    }

    const supuestos = (item.supuestos ?? [])
      .map((s) => ({
        text: (s.texto ?? "").trim(),
        likelihood: Math.min(5, Math.max(1, Math.round(Number(s.probabilidad ?? 3)))),
      }))
      .filter((s) => s.text);

    const concepto = await prisma.concept.create({
      data: {
        projectId: project.id,
        authorId: user.id,
        origin: "AGENT",
        reviewState: estado,
        position: posicion++,
        title: titulo.slice(0, 120),
        statement: enunciado,
        description: describir(item),
        origenes: {
          create: unicas.map((id) => {
            const idea = porId.get(id)!;
            return { ideaId: idea.id, textSnapshot: idea.text, insightId: idea.insightId };
          }),
        },
        supuestos: {
          create: supuestos.map((s, i) => ({ ...s, position: i, origin: "AGENT" })),
        },
      },
      select: { id: true, title: true },
    });

    yaEscritos.add(normalizar(titulo));
    creados.push({ id: concepto.id, titulo: concepto.title });
  }

  return { creados, rechazados };
}

// ─────────────────────────────────────────────────────────────────────────────
// Correccion y puntuacion
// ─────────────────────────────────────────────────────────────────────────────

/** Nombres de la API, en español, contra las columnas de los seis subcriterios. */
const PUNTUACION: Record<string, "impDemanda" | "impImplementar" | "impEscalar" | "fitProblema" | "fitEquipo" | "fitMetas"> = {
  demanda: "impDemanda",
  implementar: "impImplementar",
  escalar: "impEscalar",
  resuelveProblema: "fitProblema",
  atractivoEquipo: "fitEquipo",
  metas: "fitMetas",
};

const ROTULO_JUSTIFICACION = "Por qué esta puntuación";

export type ConceptPatch = {
  titulo?: string;
  enunciado?: string;
  estado?: string;
  /** Escala 1 a 5; 0 deja el subcriterio sin puntuar. */
  puntuacion?: Partial<Record<keyof typeof PUNTUACION, number>>;
  /**
   * Por que cada numero. Se guarda al final de la descripcion, reemplazando la
   * justificacion anterior si la habia. Sin esto el equipo ve un 2 y no sabe
   * contra que discutirlo, que es para lo que existe la matriz.
   */
  justificacion?: string;
};

export async function updateConceptById(user: SessionUser, id: string, cambios: ConceptPatch) {
  const concepto = await prisma.concept.findUnique({
    where: { id },
    select: { id: true, projectId: true, description: true },
  });
  if (!concepto) throw new AgentApiError("El concepto no existe.", 404);
  const access = await getProjectRole(user, concepto.projectId);
  if (!access) throw new AgentApiError("El concepto no existe.", 404);
  if (!canEdit(access.role)) {
    throw new AgentApiError("El token no tiene permiso de escritura en este proyecto.", 403);
  }

  const data: Record<string, unknown> = {};
  if (typeof cambios.titulo === "string" && cambios.titulo.trim()) data.title = cambios.titulo.trim();
  if (typeof cambios.enunciado === "string" && cambios.enunciado.trim()) {
    data.statement = cambios.enunciado.trim();
  }
  if (cambios.estado && ["ACCEPTED", "PROPOSED", "REJECTED"].includes(cambios.estado)) {
    data.reviewState = cambios.estado;
  }

  for (const [nombre, valor] of Object.entries(cambios.puntuacion ?? {})) {
    const columna = PUNTUACION[nombre];
    if (!columna) throw new AgentApiError(`No existe el subcriterio "${nombre}".`, 400);
    const n = Math.round(Number(valor));
    if (!Number.isFinite(n) || n < 0 || n > 5) {
      throw new AgentApiError(`"${nombre}" va de 1 a 5, o 0 para dejarlo sin puntuar.`, 400);
    }
    data[columna] = n;
  }

  if (typeof cambios.justificacion === "string" && cambios.justificacion.trim()) {
    const base = concepto.description.split(`\n\n${ROTULO_JUSTIFICACION}\n`)[0].trimEnd();
    data.description = `${base}\n\n${ROTULO_JUSTIFICACION}\n${cambios.justificacion.trim()}`;
  }

  if (Object.keys(data).length === 0) {
    throw new AgentApiError("El cambio no trae ningun campo reconocido.", 400);
  }

  const actualizado = await prisma.concept.update({
    where: { id },
    data,
    select: {
      id: true,
      title: true,
      impDemanda: true,
      impImplementar: true,
      impEscalar: true,
      fitProblema: true,
      fitEquipo: true,
      fitMetas: true,
    },
  });
  return { actualizado };
}
