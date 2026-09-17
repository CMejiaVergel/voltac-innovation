import "server-only";

import { prisma } from "@/lib/db";
import { canEdit } from "@/lib/enums";
import { PLANTILLA_CONCEPTO } from "@/lib/gimi";
import { parseShape } from "@/lib/templates";
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
  /**
   * Ids de fragmentos ACEPTADOS del mapa que sostienen el concepto. Un concepto
   * completo recorre las cinco dimensiones con al menos uno en cada una.
   */
  fragmentos?: string[];
};

// ─────────────────────────────────────────────────────────────────────────────
// Anclaje al mapa y cobertura de dimensiones
// ─────────────────────────────────────────────────────────────────────────────

/** Las dimensiones del mapa del proyecto, en el orden de su plantilla. */
async function dimensionesDe(projectId: string) {
  const map = await prisma.bomMap.findFirst({
    where: { projectId },
    orderBy: { createdAt: "asc" },
    select: { id: true, template: { select: { rows: true, cols: true } } },
  });
  if (!map) throw new AgentApiError("El proyecto no tiene mapa.", 409);
  const shape = parseShape(map.template.rows, map.template.cols);
  return { mapId: map.id, dimensiones: shape.rows.map((r) => ({ id: r.id, nombre: r.name })) };
}

/**
 * Valida los fragmentos pedidos. Tienen que estar en el mapa del proyecto,
 * aceptados y visibles: un concepto no se apoya en una propuesta sin revisar,
 * igual que un insight.
 */
async function fragmentosValidos(mapId: string, ids: string[]) {
  const unicos = [...new Set(ids)];
  const encontrados = unicos.length
    ? await prisma.fragment.findMany({
        where: { id: { in: unicos }, mapId },
        select: { id: true, rowId: true, text: true, reviewState: true, hidden: true },
      })
    : [];
  const porId = new Map(encontrados.map((f) => [f.id, f]));
  const ajenos = unicos.filter((id) => !porId.has(id));
  if (ajenos.length > 0) {
    throw new AgentApiError(`Estos fragmentos no estan en el mapa: ${ajenos.join(", ")}.`, 400);
  }
  const noAceptados = encontrados.filter((f) => f.reviewState !== "ACCEPTED" || f.hidden);
  if (noAceptados.length > 0) {
    throw new AgentApiError(
      `Un concepto se apoya en fragmentos aceptados y visibles. No lo estan: ${noAceptados.map((f) => f.id).join(", ")}.`,
      400,
    );
  }
  return unicos.map((id) => porId.get(id)!);
}

function cobertura(dimensiones: { id: string; nombre: string }[], rowIds: string[]) {
  const presentes = new Set(rowIds);
  const faltantes = dimensiones.filter((d) => !presentes.has(d.id)).map((d) => d.nombre);
  return {
    porDimension: Object.fromEntries(dimensiones.map((d) => [d.id, rowIds.filter((r) => r === d.id).length])),
    dimensionesFaltantes: faltantes,
    completo: faltantes.length === 0,
  };
}

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
  const { mapId, dimensiones } = await dimensionesDe(project.id);

  const creados: { id: string; titulo: string; dimensionesFaltantes: string[] }[] = [];
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

    let anclas: Awaited<ReturnType<typeof fragmentosValidos>>;
    try {
      anclas = await fragmentosValidos(mapId, item.fragmentos ?? []);
    } catch (e) {
      rechazados.push({ titulo, motivo: e instanceof Error ? e.message : "Fragmentos invalidos." });
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
        anclas: {
          create: anclas.map((f, i) => ({
            fragmentId: f.id,
            rowId: f.rowId,
            textSnapshot: f.text,
            position: i,
          })),
        },
      },
      select: { id: true, title: true },
    });

    yaEscritos.add(normalizar(titulo));
    creados.push({
      id: concepto.id,
      titulo: concepto.title,
      dimensionesFaltantes: cobertura(dimensiones, anclas.map((f) => f.rowId)).dimensionesFaltantes,
    });
  }

  return {
    creados,
    rechazados,
    ...(creados.some((c) => c.dimensionesFaltantes.length > 0)
      ? {
          aviso:
            "Hay conceptos incompletos: un concepto de negocio recorre las cinco dimensiones del mapa con al menos un fragmento en cada una.",
        }
      : {}),
  };
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
  /**
   * Los cinco elementos de la plantilla y el ancla. Si viene cualquiera, tienen
   * que venir los cinco: la descripcion se recompone entera y no se intenta
   * fusionar a ciegas con el texto anterior. La justificacion de la puntuacion
   * se conserva.
   */
  /** Reemplaza los fragmentos que sostienen el concepto. */
  fragmentos?: string[];
  /** Añade supuestos al final; los existentes no se tocan. */
  supuestosNuevos?: { texto: string; probabilidad?: number }[];
  quienTieneElProblema?: string;
  necesidades?: string;
  solucion?: string;
  quienLaOfrece?: string;
  comoLoResuelve?: string;
  ancla?: string;
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

  const [baseActual, justificacionActual] = concepto.description.split(`\n\n${ROTULO_JUSTIFICACION}\n`);
  const ELEMENTOS = PLANTILLA_CONCEPTO.map((e) => e.campo);
  const traeElementos = ELEMENTOS.some((c) => typeof cambios[c] === "string");

  if (traeElementos) {
    const faltan = ELEMENTOS.filter((c) => !(typeof cambios[c] === "string" && cambios[c]!.trim()));
    if (faltan.length > 0) {
      throw new AgentApiError(
        `Para corregir la descripcion hay que enviar los cinco elementos. Faltan: ${faltan.join(", ")}.`,
        400,
      );
    }
  }

  const nuevaBase = traeElementos
    ? describir({ ...(cambios as IncomingConcept), titulo: "", enunciado: "", ideas: [] })
    : baseActual.trimEnd();
  const nuevaJustificacion =
    typeof cambios.justificacion === "string" && cambios.justificacion.trim()
      ? cambios.justificacion.trim()
      : justificacionActual?.trim();

  if (traeElementos || (typeof cambios.justificacion === "string" && cambios.justificacion.trim())) {
    data.description = nuevaJustificacion
      ? `${nuevaBase}\n\n${ROTULO_JUSTIFICACION}\n${nuevaJustificacion}`
      : nuevaBase;
  }

  const { mapId, dimensiones } = await dimensionesDe(concepto.projectId);
  const anclas = cambios.fragmentos ? await fragmentosValidos(mapId, cambios.fragmentos) : null;
  const nuevos = (cambios.supuestosNuevos ?? [])
    .map((x) => ({
      text: (x.texto ?? "").trim(),
      likelihood: Math.min(5, Math.max(1, Math.round(Number(x.probabilidad ?? 3)))),
    }))
    .filter((x) => x.text);

  if (Object.keys(data).length === 0 && !anclas && nuevos.length === 0) {
    throw new AgentApiError("El cambio no trae ningun campo reconocido.", 400);
  }

  if (anclas) {
    await prisma.conceptFragment.deleteMany({ where: { conceptId: id } });
    await prisma.conceptFragment.createMany({
      data: anclas.map((f, i) => ({
        conceptId: id,
        fragmentId: f.id,
        rowId: f.rowId,
        textSnapshot: f.text,
        position: i,
      })),
    });
  }
  if (nuevos.length > 0) {
    const ultimoSup = await prisma.assumption.findFirst({
      where: { conceptId: id },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    let pos = (ultimoSup?.position ?? -1) + 1;
    for (const n of nuevos) {
      await prisma.assumption.create({
        data: { conceptId: id, text: n.text, likelihood: n.likelihood, position: pos++, origin: "AGENT" },
      });
    }
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
      anclas: { select: { rowId: true } },
    },
  });
  const { anclas: filas, ...resto } = actualizado;
  return {
    actualizado: resto,
    supuestosAgregados: nuevos.length,
    ...cobertura(dimensiones, filas.map((a) => a.rowId)),
  };
}
