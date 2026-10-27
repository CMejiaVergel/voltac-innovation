"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canEdit, asEnum, ARTIFACT_KINDS, ARTIFACT_STATUSES, ASSUMPTION_STATUSES, DETONANTE_KEYS } from "@/lib/enums";
import { getProjectRole } from "@/lib/projects";
import { CAMPOS_BROCHURE, CAMPOS_CASO, leerActuar } from "@/lib/actuar";

/**
 * Actuar v2: lo que el equipo construye en la línea recta de un concepto.
 * Las acciones devuelven el error en vez de lanzarlo porque en producción Next
 * oculta el mensaje de las excepciones.
 */

type Resultado = { ok: true } | { ok: false; error: string };
const SIN_PERMISO: Resultado = { ok: false, error: "No tienes permiso para editar este proyecto." };

async function guardConcepto(conceptId: string) {
  const user = await requireUser();
  const c = await prisma.concept.findUnique({
    where: { id: conceptId },
    select: { id: true, actuar: true, project: { select: { id: true, slug: true } } },
  });
  if (!c) return null;
  const access = await getProjectRole(user, c.project.id);
  return canEdit(access?.role) ? { user, c } : null;
}

function refrescar(slug: string) {
  revalidatePath(`/proyectos/${slug}/actuar`);
  revalidatePath(`/proyectos/${slug}`);
}

/** Brochure o caso de negocio: solo se guardan los campos conocidos. */
export async function guardarPaso(conceptId: string, paso: "brochure" | "caso", datos: Record<string, string>): Promise<Resultado> {
  const g = await guardConcepto(conceptId);
  if (!g) return SIN_PERMISO;
  const campos = (paso === "brochure" ? CAMPOS_BROCHURE : CAMPOS_CASO).map((x) => x.campo as string);
  const limpio = Object.fromEntries(campos.map((k) => [k, (datos[k] ?? "").trim().slice(0, 4000)]));
  const actual = leerActuar(g.c.actuar);
  await prisma.concept.update({ where: { id: conceptId }, data: { actuar: JSON.stringify({ ...actual, [paso]: limpio }) } });
  refrescar(g.c.project.slug);
  return { ok: true };
}

export async function guardarPropuesta(conceptId: string, texto: string): Promise<Resultado> {
  const g = await guardConcepto(conceptId);
  if (!g) return SIN_PERMISO;
  await prisma.concept.update({ where: { id: conceptId }, data: { propuestaValor: texto.trim().slice(0, 4000) } });
  refrescar(g.c.project.slug);
  return { ok: true };
}

// ─── Artefacto ───────────────────────────────────────────────────────────────

export async function crearArtefacto(conceptId: string, d: { title: string; kind: string; promise: string }): Promise<Resultado> {
  const g = await guardConcepto(conceptId);
  if (!g) return SIN_PERMISO;
  if (!d.title.trim()) return { ok: false, error: "El artefacto necesita un nombre." };
  await prisma.artifact.create({
    data: {
      projectId: g.c.project.id,
      conceptId,
      title: d.title.trim().slice(0, 160),
      kind: asEnum(ARTIFACT_KINDS, d.kind, "PROTOCEPTO"),
      promise: d.promise.trim().slice(0, 600),
    },
  });
  refrescar(g.c.project.slug);
  return { ok: true };
}

async function guardArtefacto(id: string) {
  const a = await prisma.artifact.findUnique({ where: { id }, select: { id: true, conceptId: true, iteration: true } });
  if (!a?.conceptId) return null;
  const g = await guardConcepto(a.conceptId);
  return g ? { a, slug: g.c.project.slug } : null;
}

export async function actualizarArtefacto(
  id: string,
  d: { status?: string; otraIteracion?: boolean; presentedTo?: string; promise?: string },
): Promise<Resultado> {
  const g = await guardArtefacto(id);
  if (!g) return SIN_PERMISO;
  const data: Record<string, unknown> = {};
  if (d.status) {
    data.status = asEnum(ARTIFACT_STATUSES, d.status, "BORRADOR");
    if (data.status === "PRESENTADO") data.presentedAt = new Date();
  }
  if (d.otraIteracion) data.iteration = g.a.iteration + 1;
  if (typeof d.presentedTo === "string") data.presentedTo = d.presentedTo.trim().slice(0, 300);
  if (typeof d.promise === "string") data.promise = d.promise.trim().slice(0, 600);
  await prisma.artifact.update({ where: { id }, data });
  refrescar(g.slug);
  return { ok: true };
}

export async function borrarArtefacto(id: string): Promise<Resultado> {
  const g = await guardArtefacto(id);
  if (!g) return SIN_PERMISO;
  await prisma.artifact.delete({ where: { id } });
  refrescar(g.slug);
  return { ok: true };
}

// ─── Ingeniería inversa ──────────────────────────────────────────────────────

export async function agregarSupuesto(conceptId: string, texto: string): Promise<Resultado> {
  const g = await guardConcepto(conceptId);
  if (!g) return SIN_PERMISO;
  if (!texto.trim()) return { ok: false, error: "Escriban qué tendría que ser cierto." };
  const ultimo = await prisma.assumption.findFirst({ where: { conceptId }, orderBy: { position: "desc" }, select: { position: true } });
  await prisma.assumption.create({ data: { conceptId, text: texto.trim().slice(0, 600), position: (ultimo?.position ?? -1) + 1 } });
  refrescar(g.c.project.slug);
  return { ok: true };
}

async function guardSupuesto(id: string) {
  const s = await prisma.assumption.findUnique({ where: { id }, select: { id: true, conceptId: true } });
  if (!s) return null;
  const g = await guardConcepto(s.conceptId);
  return g ? { s, slug: g.c.project.slug } : null;
}

export async function actualizarSupuesto(
  id: string,
  d: { likelihood?: number; critical?: boolean; failFastTest?: string; expectedResult?: string; trigger?: string; status?: string; note?: string },
): Promise<Resultado> {
  const g = await guardSupuesto(id);
  if (!g) return SIN_PERMISO;
  const data: Record<string, unknown> = {};
  if (typeof d.likelihood === "number") data.likelihood = Math.min(5, Math.max(1, Math.round(d.likelihood)));
  if (typeof d.critical === "boolean") {
    // Se trabajan primero las tres menos probables (IMBOK p. 67; Taller 3, lám. 26).
    if (d.critical) {
      const s = await prisma.assumption.findUnique({ where: { id }, select: { conceptId: true } });
      const ya = await prisma.assumption.count({ where: { conceptId: s!.conceptId, critical: true, NOT: { id } } });
      if (ya >= 3) return { ok: false, error: "Ya hay tres marcadas. Desmarquen una antes de elegir otra." };
    }
    data.critical = d.critical;
  }
  if (typeof d.expectedResult === "string") data.expectedResult = d.expectedResult.trim().slice(0, 1000);
  if (typeof d.trigger === "string") data.trigger = (DETONANTE_KEYS as readonly string[]).includes(d.trigger) ? d.trigger : "";
  if (typeof d.failFastTest === "string") data.failFastTest = d.failFastTest.trim().slice(0, 1000);
  if (typeof d.status === "string") data.status = asEnum(ASSUMPTION_STATUSES, d.status, "OPEN");
  if (typeof d.note === "string") data.note = d.note.trim().slice(0, 1000);
  await prisma.assumption.update({ where: { id }, data });
  refrescar(g.slug);
  return { ok: true };
}

export async function borrarSupuesto(id: string): Promise<Resultado> {
  const g = await guardSupuesto(id);
  if (!g) return SIN_PERMISO;
  await prisma.assumption.delete({ where: { id } });
  refrescar(g.slug);
  return { ok: true };
}
