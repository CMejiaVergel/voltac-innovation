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
 * Lo que el agente NO hace es puntuar. La matriz Impacto × Fit es un ejercicio
 * del equipo (CV.pdf: evaluar, intercambiar el ranking con un par, votar si
 * hay empate). Un agente que llega con los seis numeros puestos le quita al
 * equipo justo la discusion que la etapa existe para provocar.
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
