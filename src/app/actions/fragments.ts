"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canEdit, VERIFICATIONS, asEnum } from "@/lib/enums";
import { getProjectRole } from "@/lib/projects";
import { parseShape, isValidCoord } from "@/lib/templates";

/**
 * Mutaciones sobre fragmentos.
 *
 * Toda escritura pasa por `guard`, que verifica en la misma consulta que el
 * fragmento pertenece a un proyecto donde el usuario puede editar. Y toda
 * escritura deja una fila en FragmentRevision: el historial no es opcional.
 */

type Guarded = {
  userId: string;
  mapId: string;
  projectSlug: string;
};

async function guardMap(mapId: string): Promise<Guarded> {
  const user = await requireUser();
  const map = await prisma.bomMap.findUnique({
    where: { id: mapId },
    include: { project: { select: { id: true, slug: true } } },
  });
  if (!map) throw new Error("El mapa no existe.");

  const access = await getProjectRole(user, map.project.id);
  if (!canEdit(access?.role)) throw new Error("No tienes permiso para editar este proyecto.");

  return { userId: user.id, mapId: map.id, projectSlug: map.project.slug };
}

async function guardFragment(fragmentId: string) {
  const user = await requireUser();
  const fragment = await prisma.fragment.findUnique({
    where: { id: fragmentId },
    include: {
      map: {
        include: {
          template: true,
          project: { select: { id: true, slug: true } },
        },
      },
    },
  });
  if (!fragment) throw new Error("El fragmento no existe.");

  const access = await getProjectRole(user, fragment.map.project.id);
  if (!canEdit(access?.role)) throw new Error("No tienes permiso para editar este proyecto.");

  return { user, fragment, projectSlug: fragment.map.project.slug };
}

function touch(slug: string) {
  revalidatePath(`/proyectos/${slug}/bom`);
  revalidatePath(`/proyectos/${slug}/agente`);
  revalidatePath(`/proyectos/${slug}`);
}

// ─────────────────────────────────────────────────────────────────────────────

export async function createFragment(input: {
  mapId: string;
  rowId: string;
  colId: string;
  text: string;
}): Promise<{ id: string }> {
  const { userId, mapId, projectSlug } = await guardMap(input.mapId);

  const map = await prisma.bomMap.findUniqueOrThrow({
    where: { id: mapId },
    include: { template: true },
  });
  const shape = parseShape(map.template.rows, map.template.cols);
  if (!isValidCoord(shape, input.rowId, input.colId)) {
    throw new Error("Esa celda no existe en la plantilla del mapa.");
  }

  const text = input.text.trim();
  if (!text) throw new Error("El fragmento no puede estar vacio.");

  const last = await prisma.fragment.findFirst({
    where: { mapId, rowId: input.rowId, colId: input.colId },
    orderBy: { position: "desc" },
    select: { position: true },
  });

  const fragment = await prisma.fragment.create({
    data: {
      mapId,
      rowId: input.rowId,
      colId: input.colId,
      text,
      position: (last?.position ?? -1) + 1,
      verification: "TO_CONFIRM",
      reviewState: "ACCEPTED",
      origin: "HUMAN",
      authorId: userId,
    },
  });

  await prisma.fragmentRevision.create({
    data: {
      mapId,
      fragmentId: fragment.id,
      action: "CREATE",
      text,
      rowId: input.rowId,
      colId: input.colId,
      verification: "TO_CONFIRM",
      reviewState: "ACCEPTED",
      editedById: userId,
    },
  });

  touch(projectSlug);
  return { id: fragment.id };
}

export async function updateFragmentText(fragmentId: string, text: string): Promise<void> {
  const { user, fragment, projectSlug } = await guardFragment(fragmentId);
  const next = text.trim();
  if (!next) throw new Error("El fragmento no puede quedar vacio.");
  if (next === fragment.text) return;

  await prisma.fragment.update({ where: { id: fragmentId }, data: { text: next } });
  await prisma.fragmentRevision.create({
    data: { mapId: fragment.mapId, fragmentId, action: "EDIT", text: next, editedById: user.id },
  });

  touch(projectSlug);
}

export async function setVerification(fragmentId: string, verification: string): Promise<void> {
  const { user, fragment, projectSlug } = await guardFragment(fragmentId);
  const next = asEnum(VERIFICATIONS, verification, "TO_CONFIRM");
  if (next === fragment.verification) return;

  await prisma.fragment.update({ where: { id: fragmentId }, data: { verification: next } });
  await prisma.fragmentRevision.create({
    data: {
      mapId: fragment.mapId,
      fragmentId,
      action: "VERIFY",
      verification: next,
      editedById: user.id,
    },
  });

  touch(projectSlug);
}

export async function setFragmentSource(
  fragmentId: string,
  sourceUrl: string,
  sourceCitation: string,
): Promise<void> {
  const { user, fragment, projectSlug } = await guardFragment(fragmentId);

  await prisma.fragment.update({
    where: { id: fragmentId },
    data: {
      sourceUrl: sourceUrl.trim() || null,
      sourceCitation: sourceCitation.trim() || null,
    },
  });
  await prisma.fragmentRevision.create({
    data: {
      mapId: fragment.mapId,
      fragmentId,
      action: "EDIT",
      note: `Fuente: ${sourceCitation.trim() || sourceUrl.trim() || "(sin fuente)"}`,
      editedById: user.id,
    },
  });

  touch(projectSlug);
}

/**
 * Fija el contenido y el orden EXACTO de una celda.
 *
 * Sustituye al par mover-y-poner-al-final: al arrastrar, el equipo decide a la
 * vez en que celda cae el fragmento y en que posicion dentro de ella. Recibe la
 * lista ordenada de ids que debe quedar en la celda y la escribe tal cual.
 */
export async function setCellOrder(
  mapId: string,
  rowId: string,
  colId: string,
  orderedIds: string[],
): Promise<void> {
  const { userId, projectSlug } = await guardMap(mapId);

  const map = await prisma.bomMap.findUniqueOrThrow({
    where: { id: mapId },
    include: { template: true },
  });
  const shape = parseShape(map.template.rows, map.template.cols);
  if (!isValidCoord(shape, rowId, colId)) throw new Error("Celda destino invalida.");

  // Solo se tocan fragmentos de ESTE mapa: la lista viene del navegador.
  const validos = await prisma.fragment.findMany({
    where: { id: { in: orderedIds }, mapId },
    select: { id: true, rowId: true, colId: true, position: true },
  });
  const porId = new Map(validos.map((f) => [f.id, f]));

  for (const [i, id] of orderedIds.entries()) {
    const actual = porId.get(id);
    if (!actual) continue;
    if (actual.rowId === rowId && actual.colId === colId && actual.position === i) continue;

    await prisma.fragment.update({
      where: { id },
      data: { rowId, colId, position: i },
    });

    const cambioDeCelda = actual.rowId !== rowId || actual.colId !== colId;
    await prisma.fragmentRevision.create({
      data: {
        mapId,
        fragmentId: id,
        action: cambioDeCelda ? "MOVE" : "EDIT",
        rowId,
        colId,
        note: cambioDeCelda
          ? `De ${actual.rowId}|${actual.colId} a ${rowId}|${colId}, posicion ${i + 1}`
          : `Reordenado a la posicion ${i + 1}`,
        editedById: userId,
      },
    });
  }

  touch(projectSlug);
}

/** Saca un fragmento de la vista sin borrarlo, o lo devuelve. */
export async function setFragmentHidden(fragmentId: string, hidden: boolean): Promise<void> {
  const { user, fragment, projectSlug } = await guardFragment(fragmentId);
  if (fragment.hidden === hidden) return;

  await prisma.fragment.update({ where: { id: fragmentId }, data: { hidden } });
  await prisma.fragmentRevision.create({
    data: {
      mapId: fragment.mapId,
      fragmentId,
      action: "EDIT",
      note: hidden ? "Ocultado del mapa" : "Devuelto al mapa",
      editedById: user.id,
    },
  });

  touch(projectSlug);
}

/** Mueve un fragmento a otra celda y lo deja al final de esa celda. */
export async function moveFragment(
  fragmentId: string,
  rowId: string,
  colId: string,
): Promise<void> {
  const { user, fragment, projectSlug } = await guardFragment(fragmentId);
  if (fragment.rowId === rowId && fragment.colId === colId) return;

  const shape = parseShape(fragment.map.template.rows, fragment.map.template.cols);
  if (!isValidCoord(shape, rowId, colId)) throw new Error("Celda destino invalida.");

  const last = await prisma.fragment.findFirst({
    where: { mapId: fragment.mapId, rowId, colId },
    orderBy: { position: "desc" },
    select: { position: true },
  });

  await prisma.fragment.update({
    where: { id: fragmentId },
    data: { rowId, colId, position: (last?.position ?? -1) + 1 },
  });
  await prisma.fragmentRevision.create({
    data: {
      mapId: fragment.mapId,
      fragmentId,
      action: "MOVE",
      rowId,
      colId,
      note: `De ${fragment.rowId}|${fragment.colId} a ${rowId}|${colId}`,
      editedById: user.id,
    },
  });

  touch(projectSlug);
}

export async function deleteFragment(fragmentId: string): Promise<void> {
  const { user, fragment, projectSlug } = await guardFragment(fragmentId);

  // El borrado queda auditado: al eliminar el fragmento, `fragmentId` de sus
  // revisiones pasa a null (SetNull) pero las filas sobreviven con su mapId,
  // su texto y su celda. Por eso esta revision se escribe ANTES del delete.
  await prisma.fragmentRevision.create({
    data: {
      mapId: fragment.mapId,
      fragmentId,
      action: "DELETE",
      text: fragment.text,
      rowId: fragment.rowId,
      colId: fragment.colId,
      editedById: user.id,
    },
  });
  await prisma.fragment.delete({ where: { id: fragmentId } });

  touch(projectSlug);
}

// ─────────────────────────────────────────────────────────────────────────────
// Cola de revision de lo que propuso el agente
// ─────────────────────────────────────────────────────────────────────────────

export async function reviewFragment(
  fragmentId: string,
  decision: "ACCEPT" | "REJECT",
  edits?: { text?: string; rowId?: string; colId?: string; verification?: string },
): Promise<void> {
  const { user, fragment, projectSlug } = await guardFragment(fragmentId);

  if (decision === "REJECT") {
    await prisma.fragment.update({
      where: { id: fragmentId },
      data: { reviewState: "REJECTED", reviewedById: user.id, reviewedAt: new Date() },
    });
    await prisma.fragmentRevision.create({
      data: {
      mapId: fragment.mapId,
      fragmentId,
      action: "REJECT",
      reviewState: "REJECTED",
      editedById: user.id,
    },
    });
    touch(projectSlug);
    return;
  }

  const shape = parseShape(fragment.map.template.rows, fragment.map.template.cols);
  const rowId = edits?.rowId ?? fragment.rowId;
  const colId = edits?.colId ?? fragment.colId;
  if (!isValidCoord(shape, rowId, colId)) throw new Error("Celda destino invalida.");

  const text = (edits?.text ?? fragment.text).trim();
  if (!text) throw new Error("El fragmento no puede quedar vacio.");

  const last = await prisma.fragment.findFirst({
    where: { mapId: fragment.mapId, rowId, colId, reviewState: "ACCEPTED" },
    orderBy: { position: "desc" },
    select: { position: true },
  });

  await prisma.fragment.update({
    where: { id: fragmentId },
    data: {
      text,
      rowId,
      colId,
      verification: asEnum(VERIFICATIONS, edits?.verification, fragment.verification as never),
      position: (last?.position ?? -1) + 1,
      reviewState: "ACCEPTED",
      reviewedById: user.id,
      reviewedAt: new Date(),
    },
  });

  await prisma.fragmentRevision.create({
    data: {
      mapId: fragment.mapId,
      fragmentId,
      action: "ACCEPT",
      text,
      rowId,
      colId,
      reviewState: "ACCEPTED",
      note: "Aceptado en el mapa tras revision humana",
      editedById: user.id,
    },
  });

  touch(projectSlug);
}

/** Acepta de una sola vez todo lo propuesto por una corrida. */
export async function acceptRun(runId: string): Promise<number> {
  const user = await requireUser();
  const run = await prisma.researchRun.findUnique({
    where: { id: runId },
    include: { project: { select: { id: true, slug: true } } },
  });
  if (!run) throw new Error("La corrida no existe.");

  const access = await getProjectRole(user, run.project.id);
  if (!canEdit(access?.role)) throw new Error("No tienes permiso para editar este proyecto.");

  const pending = await prisma.fragment.findMany({
    where: { researchRunId: runId, reviewState: "PROPOSED" },
    select: { id: true },
  });

  for (const f of pending) {
    await reviewFragment(f.id, "ACCEPT");
  }

  touch(run.project.slug);
  return pending.length;
}
