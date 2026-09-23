"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  canEdit,
  asEnum,
  ASSUMPTION_STATUSES,
  ASSUMPTION_KINDS,
  DETONANTE_KEYS,
  SUBCRITERIOS,
} from "@/lib/enums";
import { getProjectRole } from "@/lib/projects";

/**
 * Mutaciones de la etapa Convergir.
 *
 * Un Concept apunta a las ideas de Combinar, nunca al reves — la misma regla
 * que sostiene Insight -> Fragment. Cada etapa lee la anterior y ninguna sabe
 * que existe la siguiente.
 *
 * La meta de 4 a 5 conceptos NO se impone: se avisa. Convergir es estrechar, y
 * un tablero con quince conceptos no ha convergido; pero bloquear el decimosexto
 * obligaria al equipo a borrar antes de haber decidido, que es al reves.
 */

async function guardProject(slug: string) {
  const user = await requireUser();
  const project = await prisma.project.findUnique({
    where: { slug },
    select: { id: true, slug: true },
  });
  if (!project) throw new Error("El proyecto no existe.");

  const access = await getProjectRole(user, project.id);
  if (!canEdit(access?.role)) throw new Error("No tienes permiso para editar este proyecto.");

  return { userId: user.id, projectId: project.id, slug: project.slug };
}

async function guardConcept(conceptId: string) {
  const user = await requireUser();
  const concept = await prisma.concept.findUnique({
    where: { id: conceptId },
    include: { project: { select: { id: true, slug: true } } },
  });
  if (!concept) throw new Error("El concepto no existe.");

  const access = await getProjectRole(user, concept.project.id);
  if (!canEdit(access?.role)) throw new Error("No tienes permiso para editar este proyecto.");

  return { userId: user.id, concept, slug: concept.project.slug };
}

function refrescar(slug: string) {
  revalidatePath(`/proyectos/${slug}/convergir`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Conceptos
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Crea un concepto a partir de una o varias ideas de Combinar.
 *
 * Admite varias porque fusionar ideas ES media etapa: el libro lo llama "Best
 * of All Worlds" — juntar lo bueno de conceptos separados en uno solo.
 */
export async function createConcept(
  slug: string,
  ideaIds: string[],
  titulo = "",
): Promise<{ id: string }> {
  const { userId, projectId } = await guardProject(slug);

  const unicos = [...new Set(ideaIds)];
  const ideas = unicos.length
    ? await prisma.insightIdea.findMany({
        where: { id: { in: unicos }, insight: { projectId } },
        select: { id: true, text: true, insightId: true },
      })
    : [];
  if (ideas.length !== unicos.length) {
    throw new Error("Alguna de las ideas no pertenece a este proyecto.");
  }

  const ultimo = await prisma.concept.findFirst({
    where: { projectId },
    orderBy: { position: "desc" },
    select: { position: true },
  });

  const concepto = await prisma.concept.create({
    data: {
      projectId,
      authorId: userId,
      position: (ultimo?.position ?? -1) + 1,
      title: titulo.trim() || ideas[0]?.text.slice(0, 60) || "Concepto sin nombre",
      origenes: {
        create: ideas.map((i) => ({
          ideaId: i.id,
          textSnapshot: i.text,
          insightId: i.insightId,
        })),
      },
    },
    select: { id: true },
  });

  refrescar(slug);
  return concepto;
}

const CAMPOS_TEXTO = [
  "title",
  "statement",
  "description",
  "color",
  // Ejercicio 1.1: frase «Conecte los puntos» y propuesta de valor
  "fraseOferta",
  "fraseMercado",
  "fraseNecesidad",
  "fraseEntrega",
  "fraseProduccion",
  "fraseModelo",
  "propuestaValor",
] as const;

export type CampoConcepto = (typeof CAMPOS_TEXTO)[number];

export async function updateConcept(
  conceptId: string,
  campos: Partial<Record<CampoConcepto, string>>,
): Promise<void> {
  const { concept, slug } = await guardConcept(conceptId);

  const data: Record<string, string> = {};
  for (const campo of CAMPOS_TEXTO) {
    const v = campos[campo];
    if (typeof v === "string") data[campo] = v.trim();
  }
  if (Object.keys(data).length === 0) return;
  if ("title" in data && !data.title) {
    throw new Error("El concepto necesita un nombre para poder senalarlo.");
  }
  // Vacio significa "usa la paleta": un valor invalido se degrada a eso.
  if ("color" in data && data.color && !/^#[0-9a-fA-F]{6}$/.test(data.color)) {
    data.color = "";
  }

  await prisma.concept.update({ where: { id: concept.id }, data });
  refrescar(slug);
}

/**
 * Guarda las vinetas del lienzo de una dimension (Ejercicio 1.1). Una por
 * renglon; los renglones vacios se descartan.
 */
export async function updateLienzo(
  conceptId: string,
  dimension: string,
  vinetas: string[],
): Promise<void> {
  const { concept, slug } = await guardConcept(conceptId);
  const actual = await prisma.concept.findUnique({
    where: { id: concept.id },
    select: { lienzo: true },
  });
  let lienzo: Record<string, string[]> = {};
  try {
    lienzo = JSON.parse(actual?.lienzo || "{}");
  } catch {
    lienzo = {};
  }
  const limpias = vinetas.map((v) => v.trim()).filter(Boolean).slice(0, 8);
  if (limpias.length > 0) lienzo[dimension] = limpias;
  else delete lienzo[dimension];
  await prisma.concept.update({ where: { id: concept.id }, data: { lienzo: JSON.stringify(lienzo) } });
  refrescar(slug);
}

/** Puntua uno de los seis subcriterios. 0 lo deja sin puntuar. */
export async function scoreConcept(
  conceptId: string,
  campo: string,
  valor: number,
): Promise<void> {
  const { concept, slug } = await guardConcept(conceptId);

  const valido = SUBCRITERIOS.some((s) => s.campo === campo);
  if (!valido) throw new Error("Ese criterio no existe.");
  const n = Math.round(valor);
  if (n < 0 || n > 5) throw new Error("La escala va de 1 a 5.");

  await prisma.concept.update({ where: { id: concept.id }, data: { [campo]: n } });
  refrescar(slug);
}

export async function deleteConcept(conceptId: string): Promise<void> {
  const { concept, slug } = await guardConcept(conceptId);
  await prisma.concept.delete({ where: { id: concept.id } });
  refrescar(slug);
}

export async function setConceptHidden(conceptId: string, hidden: boolean): Promise<void> {
  const { concept, slug } = await guardConcept(conceptId);
  await prisma.concept.update({ where: { id: concept.id }, data: { hidden } });
  refrescar(slug);
}

/** Conecta una idea mas al concepto. */
export async function addConceptSource(conceptId: string, ideaId: string): Promise<void> {
  const { concept, slug } = await guardConcept(conceptId);

  const idea = await prisma.insightIdea.findFirst({
    where: { id: ideaId, insight: { projectId: concept.projectId } },
    select: { id: true, text: true, insightId: true },
  });
  if (!idea) throw new Error("Esa idea no pertenece a este proyecto.");

  const ya = await prisma.conceptSource.findUnique({
    where: { conceptId_ideaId: { conceptId: concept.id, ideaId } },
  });
  if (ya) return;

  await prisma.conceptSource.create({
    data: {
      conceptId: concept.id,
      ideaId: idea.id,
      textSnapshot: idea.text,
      insightId: idea.insightId,
    },
  });
  refrescar(slug);
}

export async function removeConceptSource(sourceId: string): Promise<void> {
  const user = await requireUser();
  const src = await prisma.conceptSource.findUnique({
    where: { id: sourceId },
    include: { concept: { include: { project: { select: { id: true, slug: true } } } } },
  });
  if (!src) return;

  const access = await getProjectRole(user, src.concept.project.id);
  if (!canEdit(access?.role)) throw new Error("No tienes permiso para editar este proyecto.");

  await prisma.conceptSource.delete({ where: { id: sourceId } });
  refrescar(src.concept.project.slug);
}

// ─────────────────────────────────────────────────────────────────────────────
// Supuestos — "que tendria que ser cierto"
// ─────────────────────────────────────────────────────────────────────────────

export async function addAssumption(
  conceptId: string,
  text: string,
  likelihood = 3,
  kind: string = "CONDICION",
): Promise<void> {
  const { concept, slug } = await guardConcept(conceptId);
  const limpio = text.trim();
  if (!limpio) throw new Error("El supuesto necesita texto.");

  const ultimo = await prisma.assumption.findFirst({
    where: { conceptId: concept.id },
    orderBy: { position: "desc" },
    select: { position: true },
  });

  await prisma.assumption.create({
    data: {
      conceptId: concept.id,
      text: limpio,
      kind: asEnum(ASSUMPTION_KINDS, kind, "CONDICION"),
      likelihood: Math.min(5, Math.max(1, Math.round(likelihood))),
      position: (ultimo?.position ?? -1) + 1,
    },
  });
  refrescar(slug);
}

export async function updateAssumption(
  assumptionId: string,
  cambios: {
    text?: string;
    likelihood?: number;
    status?: string;
    note?: string;
    kind?: string;
    trigger?: string;
    critical?: boolean;
    failFastTest?: string;
    expectedResult?: string;
  },
): Promise<void> {
  const user = await requireUser();
  const sup = await prisma.assumption.findUnique({
    where: { id: assumptionId },
    include: { concept: { include: { project: { select: { id: true, slug: true } } } } },
  });
  if (!sup) throw new Error("Ese supuesto ya no existe.");

  const access = await getProjectRole(user, sup.concept.project.id);
  if (!canEdit(access?.role)) throw new Error("No tienes permiso para editar este proyecto.");

  const data: Record<string, unknown> = {};
  if (typeof cambios.text === "string") {
    const t = cambios.text.trim();
    if (!t) throw new Error("El supuesto necesita texto.");
    data.text = t;
  }
  if (typeof cambios.likelihood === "number") {
    data.likelihood = Math.min(5, Math.max(1, Math.round(cambios.likelihood)));
  }
  if (cambios.status) data.status = asEnum(ASSUMPTION_STATUSES, cambios.status, "OPEN");
  if (typeof cambios.note === "string") data.note = cambios.note.trim();
  if (cambios.kind) {
    data.kind = asEnum(ASSUMPTION_KINDS, cambios.kind, "CONDICION");
    // Un precedente ya se dio por sentado: no se trabaja, no puede ser de las tres.
    if (data.kind === "PRECEDENTE") data.critical = false;
  }
  if (typeof cambios.trigger === "string") {
    data.trigger = (DETONANTE_KEYS as readonly string[]).includes(cambios.trigger) ? cambios.trigger : "";
  }
  if (typeof cambios.critical === "boolean" && data.kind !== "PRECEDENTE") {
    data.critical = cambios.critical && sup.kind !== "PRECEDENTE";
  }
  if (typeof cambios.failFastTest === "string") data.failFastTest = cambios.failFastTest.trim();
  if (typeof cambios.expectedResult === "string") data.expectedResult = cambios.expectedResult.trim();

  if (Object.keys(data).length === 0) return;
  await prisma.assumption.update({ where: { id: assumptionId }, data });
  refrescar(sup.concept.project.slug);
}

export async function deleteAssumption(assumptionId: string): Promise<void> {
  const user = await requireUser();
  const sup = await prisma.assumption.findUnique({
    where: { id: assumptionId },
    include: { concept: { include: { project: { select: { id: true, slug: true } } } } },
  });
  if (!sup) return;

  const access = await getProjectRole(user, sup.concept.project.id);
  if (!canEdit(access?.role)) throw new Error("No tienes permiso para editar este proyecto.");

  await prisma.assumption.delete({ where: { id: assumptionId } });
  refrescar(sup.concept.project.slug);
}

/**
 * Manda un supuesto al banco de preguntas.
 *
 * Es el puente entre Convergir y el trabajo de campo: un supuesto improbable
 * del que depende un concepto atractivo es exactamente lo que hay que ir a
 * averiguar. Se guarda el enlace en los dos sentidos para que la respuesta
 * vuelva al concepto que la necesitaba.
 */
export async function assumptionToQuestion(
  assumptionId: string,
  resuelve: string,
): Promise<void> {
  const user = await requireUser();
  const sup = await prisma.assumption.findUnique({
    where: { id: assumptionId },
    include: { concept: { include: { project: { select: { id: true, slug: true } } } } },
  });
  if (!sup) throw new Error("Ese supuesto ya no existe.");

  const access = await getProjectRole(user, sup.concept.project.id);
  if (!canEdit(access?.role)) throw new Error("No tienes permiso para editar este proyecto.");
  if (sup.questionId) throw new Error("Este supuesto ya tiene una pregunta en el banco.");

  const ultima = await prisma.openQuestion.findFirst({
    where: { projectId: sup.concept.project.id },
    orderBy: { position: "desc" },
    select: { position: true },
  });

  const pregunta = await prisma.openQuestion.create({
    data: {
      projectId: sup.concept.project.id,
      // Se formula como duda concreta, que es como se escriben las del banco.
      text: sup.text.endsWith("?") ? sup.text : `¿${sup.text}?`,
      askedTo: resuelve.trim(),
      position: (ultima?.position ?? -1) + 1,
      origin: user.id ? "HUMAN" : "HUMAN",
    },
  });

  await prisma.assumption.update({
    where: { id: assumptionId },
    data: { questionId: pregunta.id },
  });

  refrescar(sup.concept.project.slug);
  revalidatePath(`/proyectos/${sup.concept.project.slug}/fuentes`);
}

/** Reordena el tablero de conceptos. */
export async function setConceptOrder(slug: string, ids: string[]): Promise<void> {
  const { projectId } = await guardProject(slug);

  const propios = await prisma.concept.findMany({
    where: { projectId },
    select: { id: true },
  });
  const validos = new Set(propios.map((c) => c.id));
  if (ids.some((id) => !validos.has(id))) {
    throw new Error("Ese concepto no es de este proyecto.");
  }

  await prisma.$transaction(
    ids.map((id, i) => prisma.concept.update({ where: { id }, data: { position: i } })),
  );
  refrescar(slug);
}
