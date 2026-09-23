"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canEdit, asEnum } from "@/lib/enums";
import { TIPOS_LECCION } from "@/lib/gimi";
import { getProjectRole } from "@/lib/projects";

/**
 * Cierre de cada sesion: aprendizajes, lo que mas se disfruto y siguientes
 * pasos (Taller 3, «Experiencia de la jornada»).
 */

async function guardProject(slug: string) {
  const user = await requireUser();
  const project = await prisma.project.findUnique({ where: { slug }, select: { id: true } });
  if (!project) throw new Error("El proyecto no existe.");
  const access = await getProjectRole(user, project.id);
  if (!canEdit(access?.role)) throw new Error("No tienes permiso para editar este proyecto.");
  return { user, project };
}

async function guardLeccion(id: string) {
  const user = await requireUser();
  const l = await prisma.leccion.findUnique({
    where: { id },
    include: { project: { select: { id: true, slug: true } } },
  });
  if (!l) throw new Error("Esa lección ya no existe.");
  const access = await getProjectRole(user, l.project.id);
  if (!canEdit(access?.role)) throw new Error("No tienes permiso para editar este proyecto.");
  return l;
}

const refrescar = (slug: string) => revalidatePath(`/proyectos/${slug}/artefactos`);

function normalizar(t: string) {
  return t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export async function addLeccion(
  slug: string,
  datos: { sesion: string; tipo: string; texto: string },
): Promise<void> {
  const { user, project } = await guardProject(slug);
  const texto = datos.texto.trim();
  if (!texto) throw new Error("La lección necesita texto.");
  const sesion = datos.sesion.trim() || "Sesión sin nombre";
  const tipo = asEnum(TIPOS_LECCION, datos.tipo, "APRENDIZAJE");

  // «No repita factores»: la misma leccion en la misma sesion no se duplica.
  const hermanas = await prisma.leccion.findMany({
    where: { projectId: project.id, sesion, tipo },
    select: { texto: true, position: true },
  });
  if (hermanas.some((h) => normalizar(h.texto) === normalizar(texto))) {
    throw new Error("Ese factor ya está en la hoja de esta sesión.");
  }

  await prisma.leccion.create({
    data: {
      projectId: project.id,
      sesion,
      tipo,
      texto,
      authorId: user.id,
      position: hermanas.reduce((m, h) => Math.max(m, h.position), -1) + 1,
    },
  });
  refrescar(slug);
}

export async function toggleLeccionHecha(id: string): Promise<void> {
  const l = await guardLeccion(id);
  await prisma.leccion.update({ where: { id }, data: { hecho: !l.hecho } });
  refrescar(l.project.slug);
}

export async function deleteLeccion(id: string): Promise<void> {
  const l = await guardLeccion(id);
  await prisma.leccion.delete({ where: { id } });
  refrescar(l.project.slug);
}
