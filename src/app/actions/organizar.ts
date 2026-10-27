"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canEdit } from "@/lib/enums";
import { getProjectRole } from "@/lib/projects";
import { HOJAS_LENTE, TIPO_ESCENARIO } from "@/lib/gimi";

/**
 * Paso 2 en la v2: organizar el mapa (grupos con etiqueta, IMBOK pp. 39 y 50),
 * marcar puntos de interés y las hojas de trabajo de las lentes.
 *
 * Devuelven el error en vez de lanzarlo porque en producción Next oculta el
 * mensaje de las excepciones.
 */

type Resultado<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const SIN_PERMISO = { ok: false as const, error: "No tienes permiso para editar este proyecto." };

async function guardProyecto(slug: string) {
  const user = await requireUser();
  const project = await prisma.project.findUnique({ where: { slug }, select: { id: true } });
  if (!project) return null;
  const access = await getProjectRole(user, project.id);
  if (!canEdit(access?.role)) return null;
  const map = await prisma.bomMap.findFirst({ where: { projectId: project.id }, orderBy: { createdAt: "asc" }, select: { id: true } });
  return { userId: user.id, projectId: project.id, mapId: map?.id ?? null };
}

function refrescar(slug: string) {
  revalidatePath(`/proyectos/${slug}/divergir`);
  revalidatePath(`/proyectos/${slug}/plataformas`);
}

// ─── Grupos ──────────────────────────────────────────────────────────────────

export async function crearGrupo(slug: string, rowId: string, nombre: string, fragmentId?: string): Promise<Resultado<{ id: string }>> {
  const g = await guardProyecto(slug);
  if (!g?.mapId) return SIN_PERMISO;
  const limpio = nombre.trim();
  if (!limpio) return { ok: false, error: "Póngale una etiqueta al grupo." };
  const ultimo = await prisma.grupoMapa.findFirst({ where: { mapId: g.mapId, rowId }, orderBy: { position: "desc" }, select: { position: true } });
  const grupo = await prisma.grupoMapa.create({
    data: { mapId: g.mapId, rowId, nombre: limpio.slice(0, 80), position: (ultimo?.position ?? -1) + 1, authorId: g.userId },
    select: { id: true },
  });
  if (fragmentId) await prisma.fragment.updateMany({ where: { id: fragmentId, mapId: g.mapId, rowId }, data: { grupoId: grupo.id } });
  refrescar(slug);
  return { ok: true, id: grupo.id };
}

export async function renombrarGrupo(slug: string, grupoId: string, nombre: string): Promise<Resultado> {
  const g = await guardProyecto(slug);
  if (!g?.mapId) return SIN_PERMISO;
  const limpio = nombre.trim();
  if (!limpio) return { ok: false, error: "El grupo necesita su etiqueta." };
  await prisma.grupoMapa.updateMany({ where: { id: grupoId, mapId: g.mapId }, data: { nombre: limpio.slice(0, 80) } });
  refrescar(slug);
  return { ok: true };
}

/** Deshace el grupo: sus post-its quedan sin agrupar, no se pierden. */
export async function deshacerGrupo(slug: string, grupoId: string): Promise<Resultado> {
  const g = await guardProyecto(slug);
  if (!g?.mapId) return SIN_PERMISO;
  await prisma.grupoMapa.deleteMany({ where: { id: grupoId, mapId: g.mapId } });
  refrescar(slug);
  return { ok: true };
}

/** Mete un post-it a un grupo de su misma dimensión, o lo saca (grupoId null). */
export async function agruparPostit(slug: string, fragmentId: string, grupoId: string | null): Promise<Resultado> {
  const g = await guardProyecto(slug);
  if (!g?.mapId) return SIN_PERMISO;
  const f = await prisma.fragment.findFirst({ where: { id: fragmentId, mapId: g.mapId }, select: { rowId: true } });
  if (!f) return { ok: false, error: "Ese post-it ya no está en el mapa." };
  if (grupoId) {
    const grupo = await prisma.grupoMapa.findFirst({ where: { id: grupoId, mapId: g.mapId }, select: { rowId: true } });
    if (!grupo) return { ok: false, error: "Ese grupo ya no existe." };
    if (grupo.rowId !== f.rowId) return { ok: false, error: "Un post-it solo se agrupa dentro de su dimensión." };
  }
  await prisma.fragment.update({ where: { id: fragmentId }, data: { grupoId } });
  refrescar(slug);
  return { ok: true };
}

// ─── Puntos de interés ───────────────────────────────────────────────────────

export async function marcarHotspot(slug: string, fragmentId: string, hotspot: boolean): Promise<Resultado> {
  const g = await guardProyecto(slug);
  if (!g?.mapId) return SIN_PERMISO;
  await prisma.fragment.updateMany({ where: { id: fragmentId, mapId: g.mapId }, data: { hotspot } });
  refrescar(slug);
  return { ok: true };
}

// ─── Hojas de las lentes ─────────────────────────────────────────────────────

export type DatosElemento = {
  colId: string;
  tipo: string;
  nombre: string;
  detalle?: string;
  impacto?: number | null;
  incertidumbre?: number | null;
  eje?: boolean;
};

function escala(n: number | null | undefined): number | null {
  if (n == null) return null;
  const v = Math.round(Number(n));
  return v >= 1 && v <= 5 ? v : null;
}

function tipoValido(colId: string, tipo: string): boolean {
  if (colId === "futuro" && tipo === TIPO_ESCENARIO) return true;
  return !!HOJAS_LENTE[colId]?.tipos.some((t) => t.key === tipo);
}

export async function guardarElemento(slug: string, id: string | null, d: DatosElemento): Promise<Resultado<{ id: string }>> {
  const g = await guardProyecto(slug);
  if (!g) return SIN_PERMISO;
  if (!tipoValido(d.colId, d.tipo)) return { ok: false, error: "Esa clasificación no existe en esta lente." };
  const nombre = d.nombre.trim();
  if (!nombre) return { ok: false, error: "Escriba el nombre." };

  // Los escenarios salen de dos tendencias: no se deja marcar una tercera.
  if (d.eje && d.colId === "futuro") {
    const ejes = await prisma.elementoLente.count({ where: { projectId: g.projectId, colId: "futuro", eje: true, NOT: id ? { id } : undefined } });
    if (ejes >= 2) return { ok: false, error: "Los escenarios se arman con dos tendencias. Desmarque una antes." };
  }

  const data = {
    tipo: d.tipo,
    nombre: nombre.slice(0, 160),
    detalle: (d.detalle ?? "").trim(),
    impacto: escala(d.impacto),
    incertidumbre: escala(d.incertidumbre),
    eje: !!d.eje,
  };
  if (id) {
    const r = await prisma.elementoLente.updateMany({ where: { id, projectId: g.projectId }, data });
    if (r.count === 0) return { ok: false, error: "Ese renglón ya no existe." };
    refrescar(slug);
    return { ok: true, id };
  }
  const ultimo = await prisma.elementoLente.findFirst({ where: { projectId: g.projectId, colId: d.colId }, orderBy: { position: "desc" }, select: { position: true } });
  const nuevo = await prisma.elementoLente.create({
    data: { projectId: g.projectId, colId: d.colId, ...data, position: (ultimo?.position ?? -1) + 1, authorId: g.userId },
    select: { id: true },
  });
  refrescar(slug);
  return { ok: true, id: nuevo.id };
}

export async function borrarElemento(slug: string, id: string): Promise<Resultado> {
  const g = await guardProyecto(slug);
  if (!g) return SIN_PERMISO;
  await prisma.elementoLente.deleteMany({ where: { id, projectId: g.projectId } });
  refrescar(slug);
  return { ok: true };
}
