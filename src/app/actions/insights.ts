"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canEdit, asEnum, DOT_ROLES, DOTS_MINIMO, REVIEW_STATES } from "@/lib/enums";
import { getProjectRole } from "@/lib/projects";
import { generateInsights } from "@/lib/agent/insightRun";

/**
 * Mutaciones de la etapa Combinar.
 *
 * Un insight vive en el proyecto, no en el mapa, y APUNTA a los fragmentos.
 * Nunca al reves: el mapa no sabe que los insights existen, para que llenarlo
 * siga siendo un ejercicio crudo (ver la nota del modelo Fragment).
 *
 * La unica regla que la plataforma impone por su cuenta es el minimo de puntos.
 * Todo lo demas —que la frase sea concluyente, que la contraparte exista— se
 * avisa pero no se bloquea: la metodologia prohibe rellenar por cuota, y una
 * validacion dura empujaria al equipo a inventar para poder guardar.
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

async function guardInsight(insightId: string) {
  const user = await requireUser();
  const insight = await prisma.insight.findUnique({
    where: { id: insightId },
    include: { project: { select: { id: true, slug: true } } },
  });
  if (!insight) throw new Error("El insight no existe.");

  const access = await getProjectRole(user, insight.project.id);
  if (!canEdit(access?.role)) throw new Error("No tienes permiso para editar este proyecto.");

  return { userId: user.id, insight, slug: insight.project.slug };
}

function refrescar(slug: string) {
  revalidatePath(`/proyectos/${slug}/combinar`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Crear y editar
// ─────────────────────────────────────────────────────────────────────────────

export type CampoInsight =
  | "tag"
  | "statement"
  | "fact"
  | "counterpart"
  | "shift"
  | "offerWho"
  | "offerProof"
  | "payWho"
  | "payProof"
  | "business"
  | "limitNote";

const CAMPOS: CampoInsight[] = [
  "tag",
  "statement",
  "fact",
  "counterpart",
  "shift",
  "offerWho",
  "offerProof",
  "payWho",
  "payProof",
  "business",
  "limitNote",
];

/**
 * Crea un insight a partir de los puntos que el equipo selecciono en el mapa.
 *
 * Los puntos se guardan con una COPIA del texto del fragmento. Si mañana
 * alguien borra ese fragmento, el insight no pierde la pata en silencio: el
 * punto queda huerfano y visible, que es lo que obliga a revisarlo.
 */
export async function createInsight(
  slug: string,
  fragmentIds: string[],
  campos: Partial<Record<CampoInsight, string>> = {},
): Promise<{ id: string }> {
  const { userId, projectId } = await guardProject(slug);

  const unicos = [...new Set(fragmentIds)];
  if (unicos.length < DOTS_MINIMO) {
    throw new Error(
      `Un insight conecta al menos ${DOTS_MINIMO} puntos. Con uno solo no se combina nada: se esta glosando un fragmento.`,
    );
  }

  // Los fragmentos tienen que ser de este proyecto. Sin esta comprobacion se
  // podria colgar un insight de puntos de otro proyecto pasando ids a mano.
  const fragmentos = await prisma.fragment.findMany({
    where: { id: { in: unicos }, map: { projectId } },
    select: { id: true, text: true, rowId: true, colId: true },
  });
  if (fragmentos.length !== unicos.length) {
    throw new Error("Alguno de los puntos no pertenece al mapa de este proyecto.");
  }

  const orden = new Map(unicos.map((id, i) => [id, i]));
  const statement = (campos.statement ?? "").trim();

  const insight = await prisma.insight.create({
    data: {
      projectId,
      authorId: userId,
      origin: "HUMAN",
      statement: statement || "Insight sin enunciar",
      tag: (campos.tag ?? "").trim(),
      fact: (campos.fact ?? "").trim(),
      counterpart: (campos.counterpart ?? "").trim(),
      shift: (campos.shift ?? "").trim(),
      offerWho: (campos.offerWho ?? "").trim(),
      offerProof: (campos.offerProof ?? "").trim(),
      payWho: (campos.payWho ?? "").trim(),
      payProof: (campos.payProof ?? "").trim(),
      business: (campos.business ?? "").trim(),
      limitNote: (campos.limitNote ?? "").trim(),
      position: await siguientePosicion(projectId),
      dots: {
        create: fragmentos.map((f) => ({
          fragmentId: f.id,
          textSnapshot: f.text,
          rowId: f.rowId,
          colId: f.colId,
          role: "APOYO",
          position: orden.get(f.id) ?? 0,
        })),
      },
    },
    select: { id: true },
  });

  refrescar(slug);
  return insight;
}

async function siguientePosicion(projectId: string) {
  const ultimo = await prisma.insight.findFirst({
    where: { projectId },
    orderBy: { position: "desc" },
    select: { position: true },
  });
  return (ultimo?.position ?? -1) + 1;
}

/** Cambia uno o varios campos de texto del insight. */
export async function updateInsight(
  insightId: string,
  campos: Partial<Record<CampoInsight, string>>,
): Promise<void> {
  const { insight, slug } = await guardInsight(insightId);

  const data: Record<string, string> = {};
  for (const campo of CAMPOS) {
    const valor = campos[campo];
    if (typeof valor === "string") data[campo] = valor.trim();
  }
  if (Object.keys(data).length === 0) return;

  if ("statement" in data && !data.statement) {
    throw new Error("El insight necesita su frase. Es lo unico que no puede quedar vacio.");
  }

  await prisma.insight.update({ where: { id: insight.id }, data });
  refrescar(slug);
}

// ─────────────────────────────────────────────────────────────────────────────
// Puntos
// ─────────────────────────────────────────────────────────────────────────────

/** Conecta un fragmento mas al insight. */
export async function addDot(insightId: string, fragmentId: string): Promise<void> {
  const { insight, slug } = await guardInsight(insightId);

  const fragmento = await prisma.fragment.findFirst({
    where: { id: fragmentId, map: { projectId: insight.projectId } },
    select: { id: true, text: true, rowId: true, colId: true },
  });
  if (!fragmento) throw new Error("Ese punto no pertenece al mapa de este proyecto.");

  const ya = await prisma.insightDot.findUnique({
    where: { insightId_fragmentId: { insightId: insight.id, fragmentId } },
  });
  if (ya) return; // conectarlo dos veces no es un error, simplemente ya esta

  const ultimo = await prisma.insightDot.findFirst({
    where: { insightId: insight.id },
    orderBy: { position: "desc" },
    select: { position: true },
  });

  await prisma.insightDot.create({
    data: {
      insightId: insight.id,
      fragmentId,
      textSnapshot: fragmento.text,
      rowId: fragmento.rowId,
      colId: fragmento.colId,
      position: (ultimo?.position ?? -1) + 1,
    },
  });
  refrescar(slug);
}

/** Desconecta un punto. Si dejaria el insight por debajo del minimo, no deja. */
export async function removeDot(dotId: string): Promise<void> {
  const user = await requireUser();
  const dot = await prisma.insightDot.findUnique({
    where: { id: dotId },
    include: { insight: { include: { project: { select: { id: true, slug: true } } } } },
  });
  if (!dot) throw new Error("Ese punto ya no existe.");

  const access = await getProjectRole(user, dot.insight.project.id);
  if (!canEdit(access?.role)) throw new Error("No tienes permiso para editar este proyecto.");

  const cuantos = await prisma.insightDot.count({ where: { insightId: dot.insightId } });
  if (cuantos <= DOTS_MINIMO) {
    throw new Error(
      `El insight se quedaria con ${cuantos - 1} punto. Si ya no se sostiene, elimina el insight entero en vez de vaciarlo.`,
    );
  }

  await prisma.insightDot.delete({ where: { id: dotId } });
  refrescar(dot.insight.project.slug);
}

/** Marca que papel juega un punto: la primera punta, la segunda, o apoyo. */
export async function setDotRole(dotId: string, role: string): Promise<void> {
  const user = await requireUser();
  const dot = await prisma.insightDot.findUnique({
    where: { id: dotId },
    include: { insight: { include: { project: { select: { id: true, slug: true } } } } },
  });
  if (!dot) throw new Error("Ese punto ya no existe.");

  const access = await getProjectRole(user, dot.insight.project.id);
  if (!canEdit(access?.role)) throw new Error("No tienes permiso para editar este proyecto.");

  await prisma.insightDot.update({
    where: { id: dotId },
    data: { role: asEnum(DOT_ROLES, role, "APOYO") },
  });
  refrescar(dot.insight.project.slug);
}

/** Reordena los puntos: define el trazo del recorrido en el mapa. */
export async function setDotOrder(insightId: string, dotIds: string[]): Promise<void> {
  const { insight, slug } = await guardInsight(insightId);

  const propios = await prisma.insightDot.findMany({
    where: { insightId: insight.id },
    select: { id: true },
  });
  const validos = new Set(propios.map((d) => d.id));
  if (dotIds.some((id) => !validos.has(id))) {
    throw new Error("Ese punto no es de este insight.");
  }

  await prisma.$transaction(
    dotIds.map((id, i) =>
      prisma.insightDot.update({ where: { id }, data: { position: i } }),
    ),
  );
  refrescar(slug);
}

// ─────────────────────────────────────────────────────────────────────────────
// Ideas
// ─────────────────────────────────────────────────────────────────────────────

export async function addIdea(insightId: string, text: string): Promise<void> {
  const { insight, slug } = await guardInsight(insightId);
  const limpio = text.trim();
  if (!limpio) throw new Error("La idea necesita texto.");

  const ultima = await prisma.insightIdea.findFirst({
    where: { insightId: insight.id },
    orderBy: { position: "desc" },
    select: { position: true },
  });

  await prisma.insightIdea.create({
    data: { insightId: insight.id, text: limpio, position: (ultima?.position ?? -1) + 1 },
  });
  refrescar(slug);
}

export async function updateIdea(ideaId: string, text: string): Promise<void> {
  const user = await requireUser();
  const idea = await prisma.insightIdea.findUnique({
    where: { id: ideaId },
    include: { insight: { include: { project: { select: { id: true, slug: true } } } } },
  });
  if (!idea) throw new Error("Esa idea ya no existe.");

  const access = await getProjectRole(user, idea.insight.project.id);
  if (!canEdit(access?.role)) throw new Error("No tienes permiso para editar este proyecto.");

  const limpio = text.trim();
  if (!limpio) throw new Error("La idea necesita texto.");

  await prisma.insightIdea.update({ where: { id: ideaId }, data: { text: limpio } });
  refrescar(idea.insight.project.slug);
}

export async function deleteIdea(ideaId: string): Promise<void> {
  const user = await requireUser();
  const idea = await prisma.insightIdea.findUnique({
    where: { id: ideaId },
    include: { insight: { include: { project: { select: { id: true, slug: true } } } } },
  });
  if (!idea) return;

  const access = await getProjectRole(user, idea.insight.project.id);
  if (!canEdit(access?.role)) throw new Error("No tienes permiso para editar este proyecto.");

  await prisma.insightIdea.delete({ where: { id: ideaId } });
  refrescar(idea.insight.project.slug);
}

// ─────────────────────────────────────────────────────────────────────────────
// Estado
// ─────────────────────────────────────────────────────────────────────────────

/** Acepta o descarta un insight propuesto por el agente. */
export async function reviewInsight(
  insightId: string,
  decision: "ACCEPT" | "REJECT",
): Promise<void> {
  const { insight, slug } = await guardInsight(insightId);

  if (decision === "REJECT") {
    await prisma.insight.delete({ where: { id: insight.id } });
  } else {
    await prisma.insight.update({
      where: { id: insight.id },
      data: { reviewState: "ACCEPTED" },
    });
  }
  refrescar(slug);
}

export async function setInsightHidden(insightId: string, hidden: boolean): Promise<void> {
  const { insight, slug } = await guardInsight(insightId);
  await prisma.insight.update({ where: { id: insight.id }, data: { hidden } });
  refrescar(slug);
}

export async function setInsightState(insightId: string, state: string): Promise<void> {
  const { insight, slug } = await guardInsight(insightId);
  await prisma.insight.update({
    where: { id: insight.id },
    data: { reviewState: asEnum(REVIEW_STATES, state, "ACCEPTED") },
  });
  refrescar(slug);
}

export async function deleteInsight(insightId: string): Promise<void> {
  const { insight, slug } = await guardInsight(insightId);
  await prisma.insight.delete({ where: { id: insight.id } });
  refrescar(slug);
}

/** Reordena el tablero de insights. */
export async function setInsightOrder(slug: string, insightIds: string[]): Promise<void> {
  const { projectId } = await guardProject(slug);

  const propios = await prisma.insight.findMany({
    where: { projectId },
    select: { id: true },
  });
  const validos = new Set(propios.map((i) => i.id));
  if (insightIds.some((id) => !validos.has(id))) {
    throw new Error("Ese insight no es de este proyecto.");
  }

  await prisma.$transaction(
    insightIds.map((id, i) => prisma.insight.update({ where: { id }, data: { position: i } })),
  );
  refrescar(slug);
}

// ─────────────────────────────────────────────────────────────────────────────
// Agente
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Pide al agente que combine puntos y proponga insights.
 *
 * Entran como PROPOSED: nada del modelo llega al tablero sin que una persona
 * lo acepte, igual que con los fragmentos del mapa.
 */
export async function generateInsightsAction(
  slug: string,
  formData: FormData,
): Promise<void> {
  const { userId, projectId } = await guardProject(slug);

  const cuantos = Number(formData.get("cuantos") ?? 3);
  const dimensiones = formData
    .getAll("dimensiones")
    .map(String)
    .filter(Boolean);
  const nota = String(formData.get("nota") ?? "").trim();

  await generateInsights({
    projectId,
    userId,
    scope: {
      cuantos: Number.isFinite(cuantos) ? Math.min(Math.max(cuantos, 1), 8) : 3,
      dimensiones: dimensiones.length ? dimensiones : undefined,
      nota: nota || undefined,
    },
  });

  refrescar(slug);
}
