"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canEdit } from "@/lib/enums";
import { getProjectRole } from "@/lib/projects";
import { ALCANCES_PLATAFORMA, DESARROLLO_PLATAFORMA } from "@/lib/gimi";
import { leerJsonSeguro } from "@/lib/v2";

/**
 * Paso 3 · Plataformas de Crecimiento (IMBOK pp. 51-60). Tres actividades:
 * identificar plataformas agrupando fragmentos del mapa, priorizar una con
 * criterios del equipo y desarrollar la priorizada.
 *
 * Devuelven el error en vez de lanzarlo porque en producción Next oculta el
 * mensaje de las excepciones.
 */

type Resultado<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const SIN_PERMISO = { ok: false as const, error: "No tienes permiso para editar este proyecto." };

export type Criterio = { id: string; nombre: string };
export type Desarrollo = Partial<Record<(typeof DESARROLLO_PLATAFORMA)[number]["key"], string>> & { insightIds?: string[] };

async function guardProyecto(slug: string) {
  const user = await requireUser();
  const project = await prisma.project.findUnique({ where: { slug }, select: { id: true } });
  if (!project) return null;
  const access = await getProjectRole(user, project.id);
  if (!canEdit(access?.role)) return null;
  return { userId: user.id, projectId: project.id };
}

function refrescar(slug: string) {
  revalidatePath(`/proyectos/${slug}/plataformas`);
  revalidatePath(`/proyectos/${slug}`);
}

export async function crearPlataforma(slug: string, nombre: string, fragmentIds: string[] = []): Promise<Resultado<{ id: string }>> {
  const g = await guardProyecto(slug);
  if (!g) return SIN_PERMISO;
  const limpio = nombre.trim();
  if (!limpio) return { ok: false, error: "Póngale un nombre a la plataforma." };
  const validos = await prisma.fragment.findMany({ where: { id: { in: fragmentIds }, map: { projectId: g.projectId } }, select: { id: true } });
  const ultimo = await prisma.plataforma.findFirst({ where: { projectId: g.projectId }, orderBy: { position: "desc" }, select: { position: true } });
  const p = await prisma.plataforma.create({
    data: {
      projectId: g.projectId,
      nombre: limpio.slice(0, 120),
      authorId: g.userId,
      position: (ultimo?.position ?? -1) + 1,
      fragmentos: { create: validos.map((f) => ({ fragmentId: f.id })) },
    },
    select: { id: true },
  });
  refrescar(slug);
  return { ok: true, id: p.id };
}

export async function guardarPlataforma(
  slug: string,
  id: string,
  d: { nombre?: string; historia?: string; alcance?: string; seleccionada?: boolean },
): Promise<Resultado> {
  const g = await guardProyecto(slug);
  if (!g) return SIN_PERMISO;
  const data: { nombre?: string; historia?: string; alcance?: string; seleccionada?: boolean } = {};
  if (d.nombre !== undefined) {
    if (!d.nombre.trim()) return { ok: false, error: "La plataforma necesita su nombre." };
    data.nombre = d.nombre.trim().slice(0, 120);
  }
  if (d.historia !== undefined) data.historia = d.historia.trim();
  if (d.alcance !== undefined) data.alcance = ALCANCES_PLATAFORMA.some((a) => a.key === d.alcance) ? d.alcance : "";
  if (d.seleccionada !== undefined) {
    // El IMBOK pide seleccionar las cinco que más resuenan (p. 56).
    if (d.seleccionada) {
      const ya = await prisma.plataforma.count({ where: { projectId: g.projectId, seleccionada: true, NOT: { id } } });
      if (ya >= 5) return { ok: false, error: "Ya hay cinco seleccionadas. Quite una antes de agregar otra." };
    }
    data.seleccionada = d.seleccionada;
  }
  const r = await prisma.plataforma.updateMany({ where: { id, projectId: g.projectId }, data });
  if (r.count === 0) return { ok: false, error: "Esa plataforma ya no existe." };
  refrescar(slug);
  return { ok: true };
}

/** Engancha o suelta un fragmento del mapa. */
export async function alternarFragmento(slug: string, plataformaId: string, fragmentId: string): Promise<Resultado> {
  const g = await guardProyecto(slug);
  if (!g) return SIN_PERMISO;
  const p = await prisma.plataforma.findFirst({ where: { id: plataformaId, projectId: g.projectId }, select: { id: true } });
  const f = await prisma.fragment.findFirst({ where: { id: fragmentId, map: { projectId: g.projectId } }, select: { id: true } });
  if (!p || !f) return { ok: false, error: "No se encontró la plataforma o el post-it." };
  const ya = await prisma.plataformaFragmento.findUnique({ where: { plataformaId_fragmentId: { plataformaId, fragmentId } } });
  if (ya) await prisma.plataformaFragmento.delete({ where: { id: ya.id } });
  else await prisma.plataformaFragmento.create({ data: { plataformaId, fragmentId } });
  refrescar(slug);
  return { ok: true };
}

export async function borrarPlataforma(slug: string, id: string): Promise<Resultado> {
  const g = await guardProyecto(slug);
  if (!g) return SIN_PERMISO;
  await prisma.plataforma.deleteMany({ where: { id, projectId: g.projectId } });
  refrescar(slug);
  return { ok: true };
}

// ─── Priorizar ───────────────────────────────────────────────────────────────

export async function guardarCriterios(slug: string, criterios: Criterio[]): Promise<Resultado> {
  const g = await guardProyecto(slug);
  if (!g) return SIN_PERMISO;
  const limpios = criterios
    .map((c) => ({ id: c.id.trim() || Math.random().toString(36).slice(2, 10), nombre: c.nombre.trim().slice(0, 80) }))
    .filter((c) => c.nombre);
  await prisma.project.update({ where: { id: g.projectId }, data: { criteriosPlataforma: JSON.stringify(limpios) } });
  refrescar(slug);
  return { ok: true };
}

export async function puntuarPlataforma(slug: string, id: string, criterioId: string, valor: number | null): Promise<Resultado> {
  const g = await guardProyecto(slug);
  if (!g) return SIN_PERMISO;
  const p = await prisma.plataforma.findFirst({ where: { id, projectId: g.projectId }, select: { puntajes: true } });
  if (!p) return { ok: false, error: "Esa plataforma ya no existe." };
  const puntajes = leerJsonSeguro<Record<string, number>>(p.puntajes, {});
  if (valor == null) delete puntajes[criterioId];
  else if (Number.isInteger(valor) && valor >= 1 && valor <= 5) puntajes[criterioId] = valor;
  else return { ok: false, error: "La escala va de 1 a 5." };
  await prisma.plataforma.update({ where: { id }, data: { puntajes: JSON.stringify(puntajes) } });
  refrescar(slug);
  return { ok: true };
}

/** Solo una sigue adelante (IMBOK p. 57). Volver a tocarla la desmarca. */
export async function priorizarPlataforma(slug: string, id: string): Promise<Resultado> {
  const g = await guardProyecto(slug);
  if (!g) return SIN_PERMISO;
  const p = await prisma.plataforma.findFirst({ where: { id, projectId: g.projectId }, select: { priorizada: true } });
  if (!p) return { ok: false, error: "Esa plataforma ya no existe." };
  await prisma.$transaction([
    prisma.plataforma.updateMany({ where: { projectId: g.projectId }, data: { priorizada: false } }),
    ...(p.priorizada ? [] : [prisma.plataforma.update({ where: { id }, data: { priorizada: true, seleccionada: true } })]),
  ]);
  refrescar(slug);
  return { ok: true };
}

// ─── Desarrollar ─────────────────────────────────────────────────────────────

export async function guardarDesarrollo(slug: string, id: string, desarrollo: Desarrollo): Promise<Resultado> {
  const g = await guardProyecto(slug);
  if (!g) return SIN_PERMISO;
  const limpio: Desarrollo = {};
  for (const b of DESARROLLO_PLATAFORMA) {
    const v = desarrollo[b.key];
    if (typeof v === "string") limpio[b.key] = v.trim();
  }
  if (Array.isArray(desarrollo.insightIds)) {
    const ids = desarrollo.insightIds.filter((x) => typeof x === "string");
    const validos = await prisma.insight.findMany({ where: { id: { in: ids }, projectId: g.projectId }, select: { id: true } });
    limpio.insightIds = validos.map((v) => v.id);
  }
  const r = await prisma.plataforma.updateMany({ where: { id, projectId: g.projectId }, data: { desarrollo: JSON.stringify(limpio) } });
  if (r.count === 0) return { ok: false, error: "Esa plataforma ya no existe." };
  refrescar(slug);
  return { ok: true };
}
