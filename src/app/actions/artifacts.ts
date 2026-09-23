"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  canEdit,
  asEnum,
  ARTIFACT_KINDS,
  ARTIFACT_STATUSES,
  CLAIM_KINDS,
  FEEDBACK_VERDICTS,
} from "@/lib/enums";
import { getProjectRole } from "@/lib/projects";

/**
 * Mutaciones de la etapa Actuar: artefactos de innovacion.
 *
 * Misma direccion de las flechas que el resto del proceso: el artefacto apunta
 * al concepto, a sus supuestos y a fragmentos del mapa. Nada de lo anterior
 * sabe que el artefacto existe, salvo en un punto deliberado: la reaccion de
 * la empresa puede confirmar o refutar un supuesto. Es la unica escritura
 * hacia atras del proceso, y es la que cierra el ciclo.
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

async function guardArtifact(artifactId: string) {
  const user = await requireUser();
  const artifact = await prisma.artifact.findUnique({
    where: { id: artifactId },
    include: { project: { select: { id: true, slug: true } } },
  });
  if (!artifact) throw new Error("El artefacto no existe.");

  const access = await getProjectRole(user, artifact.project.id);
  if (!canEdit(access?.role)) throw new Error("No tienes permiso para editar este proyecto.");

  return { userId: user.id, artifact, slug: artifact.project.slug };
}

function refrescar(slug: string) {
  revalidatePath(`/proyectos/${slug}/artefactos`);
}

/** El supuesto tiene que ser del concepto del artefacto, no de otro. */
async function supuestoDelConcepto(assumptionId: string, conceptId: string | null) {
  if (!conceptId) throw new Error("Este artefacto no tiene concepto: no hay supuestos que exponer.");
  const sup = await prisma.assumption.findFirst({
    where: { id: assumptionId, conceptId },
    select: { id: true, note: true },
  });
  if (!sup) throw new Error("Ese supuesto no pertenece al concepto de este artefacto.");
  return sup;
}

// ─────────────────────────────────────────────────────────────────────────────
// Artefactos
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Crea un artefacto sobre un concepto.
 *
 * El concepto es obligatorio aqui aunque en la base sea opcional. En la base
 * es opcional para que borrar un concepto no borre lo que ya se le mostro a la
 * empresa; al crear, sin concepto no hay de donde salgan los supuestos.
 */
export async function createArtifact(
  slug: string,
  datos: { conceptId: string; title: string; kind?: string; promise?: string },
): Promise<{ id: string }> {
  const { projectId } = await guardProject(slug);

  const title = datos.title.trim();
  if (!title) throw new Error("El artefacto necesita un nombre.");

  const concept = await prisma.concept.findFirst({
    where: { id: datos.conceptId, projectId },
    select: { id: true },
  });
  if (!concept) throw new Error("Elige un concepto de este proyecto.");

  const ultimo = await prisma.artifact.findFirst({
    where: { projectId },
    orderBy: { position: "desc" },
    select: { position: true },
  });

  const creado = await prisma.artifact.create({
    data: {
      projectId,
      conceptId: concept.id,
      title,
      kind: asEnum(ARTIFACT_KINDS, datos.kind, "LANDING"),
      promise: (datos.promise ?? "").trim(),
      position: (ultimo?.position ?? -1) + 1,
    },
    select: { id: true },
  });

  refrescar(slug);
  return creado;
}

export async function updateArtifact(
  artifactId: string,
  cambios: {
    title?: string;
    kind?: string;
    promise?: string;
    status?: string;
    presentedTo?: string;
    iteration?: number;
  },
): Promise<void> {
  const { artifact, slug } = await guardArtifact(artifactId);

  const data: Record<string, unknown> = {};
  if (typeof cambios.title === "string") {
    const t = cambios.title.trim();
    if (!t) throw new Error("El artefacto necesita un nombre.");
    data.title = t;
  }
  if (cambios.kind) data.kind = asEnum(ARTIFACT_KINDS, cambios.kind, "LANDING");
  if (typeof cambios.promise === "string") data.promise = cambios.promise.trim();
  if (typeof cambios.presentedTo === "string") data.presentedTo = cambios.presentedTo.trim();
  if (typeof cambios.iteration === "number") {
    data.iteration = Math.min(99, Math.max(1, Math.round(cambios.iteration)));
  }
  if (cambios.status) {
    const status = asEnum(ARTIFACT_STATUSES, cambios.status, "BORRADOR");
    data.status = status;
    // La fecha la pone el servidor la primera vez: es cuando se expuso, no
    // cuando alguien se acordo de marcarlo.
    if (status === "PRESENTADO" && !artifact.presentedAt) data.presentedAt = new Date();
  }

  if (Object.keys(data).length === 0) return;
  await prisma.artifact.update({ where: { id: artifactId }, data });
  refrescar(slug);
}

export async function deleteArtifact(artifactId: string): Promise<void> {
  const { slug } = await guardArtifact(artifactId);
  await prisma.artifact.delete({ where: { id: artifactId } });
  refrescar(slug);
}

// ─────────────────────────────────────────────────────────────────────────────
// Supuestos expuestos
// ─────────────────────────────────────────────────────────────────────────────

export async function setArtifactAssumption(
  artifactId: string,
  assumptionId: string,
  expuesto: boolean,
): Promise<void> {
  const { artifact, slug } = await guardArtifact(artifactId);
  await supuestoDelConcepto(assumptionId, artifact.conceptId);

  if (expuesto) {
    await prisma.artifactAssumption.upsert({
      where: { artifactId_assumptionId: { artifactId, assumptionId } },
      update: {},
      create: { artifactId, assumptionId },
    });
  } else {
    await prisma.artifactAssumption.deleteMany({ where: { artifactId, assumptionId } });
  }
  refrescar(slug);
}

// ─────────────────────────────────────────────────────────────────────────────
// Cifras
// ─────────────────────────────────────────────────────────────────────────────

export async function addClaim(
  artifactId: string,
  datos: { value: string; label: string; kind?: string; basis?: string; fragmentId?: string },
): Promise<void> {
  const { artifact, slug } = await guardArtifact(artifactId);

  const value = datos.value.trim();
  const label = datos.label.trim();
  if (!value || !label) throw new Error("La cifra necesita el valor y lo que mide.");

  let fragmentId: string | null = null;
  if (datos.fragmentId) {
    const frag = await prisma.fragment.findFirst({
      where: { id: datos.fragmentId, map: { projectId: artifact.projectId } },
      select: { id: true },
    });
    if (!frag) throw new Error("Ese fragmento no pertenece al mapa de este proyecto.");
    fragmentId = frag.id;
  }

  // Un hecho sin fragmento no es un hecho. No se rechaza: se degrada, igual
  // que un VERIFIED sin fuente, para que la cifra no se pierda pero tampoco
  // se lea como medida.
  const pedido = asEnum(CLAIM_KINDS, datos.kind, "ESTIMACION");
  const kind = pedido === "HECHO" && !fragmentId ? "ESTIMACION" : pedido;

  const ultimo = await prisma.artifactClaim.findFirst({
    where: { artifactId },
    orderBy: { position: "desc" },
    select: { position: true },
  });

  await prisma.artifactClaim.create({
    data: {
      artifactId,
      value,
      label,
      kind,
      basis: (datos.basis ?? "").trim(),
      fragmentId,
      position: (ultimo?.position ?? -1) + 1,
    },
  });
  refrescar(slug);
}

export async function deleteClaim(claimId: string): Promise<void> {
  const claim = await prisma.artifactClaim.findUnique({
    where: { id: claimId },
    select: { artifactId: true },
  });
  if (!claim) throw new Error("Esa cifra ya no existe.");
  const { slug } = await guardArtifact(claim.artifactId);
  await prisma.artifactClaim.delete({ where: { id: claimId } });
  refrescar(slug);
}

// ─────────────────────────────────────────────────────────────────────────────
// Reacciones de la empresa
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Registra lo que respondio la empresa.
 *
 * Si la reaccion confirma o refuta un supuesto, el supuesto cambia de estado y
 * la reaccion queda anotada en su nota. Es la escritura hacia atras que cierra
 * el ciclo: sin ella, el artefacto seria otra presentacion que se muestra y
 * termina ahi.
 */
export async function addFeedback(
  artifactId: string,
  datos: { text: string; source?: string; assumptionId?: string; verdict?: string },
): Promise<void> {
  const { userId, artifact, slug } = await guardArtifact(artifactId);

  const text = datos.text.trim();
  if (!text) throw new Error("Escribe lo que respondio la empresa.");

  const source = (datos.source ?? "").trim();
  const verdict = datos.verdict ? asEnum(FEEDBACK_VERDICTS, datos.verdict, "MATIZA") : "";
  const sup = datos.assumptionId
    ? await supuestoDelConcepto(datos.assumptionId, artifact.conceptId)
    : null;

  if (verdict && !sup) {
    throw new Error("Para confirmar, refutar o matizar hay que elegir a que supuesto responde.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.artifactFeedback.create({
      data: {
        artifactId,
        text,
        source,
        assumptionId: sup?.id ?? null,
        verdict,
        authorId: userId,
      },
    });

    if (sup && verdict) {
      const fecha = new Date().toLocaleDateString("es-CO");
      const linea = `${fecha} · ${source || "La empresa"}, sobre «${artifact.title}»: ${text}`;
      await tx.assumption.update({
        where: { id: sup.id },
        data: {
          note: sup.note ? `${sup.note}\n${linea}` : linea,
          ...(verdict === "CONFIRMA" ? { status: "CONFIRMED" } : {}),
          ...(verdict === "REFUTA" ? { status: "REFUTED" } : {}),
        },
      });
    }
  });

  refrescar(slug);
  // El supuesto tambien se ve en Convergir: si cambio, esa pantalla tambien.
  if (sup && verdict) revalidatePath(`/proyectos/${slug}/convergir`);
}

/**
 * Borra una reaccion. NO revierte el estado del supuesto: si alguien se
 * equivoco al refutarlo, se corrige en Convergir, a la vista. Revertirlo en
 * silencio desde aqui borraria una decision sin dejar rastro.
 */
export async function deleteFeedback(feedbackId: string): Promise<void> {
  const fb = await prisma.artifactFeedback.findUnique({
    where: { id: feedbackId },
    select: { artifactId: true },
  });
  if (!fb) throw new Error("Esa reaccion ya no existe.");
  const { slug } = await guardArtifact(fb.artifactId);
  await prisma.artifactFeedback.delete({ where: { id: feedbackId } });
  refrescar(slug);
}
