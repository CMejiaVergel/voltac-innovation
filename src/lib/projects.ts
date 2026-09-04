import "server-only";

import { notFound } from "next/navigation";

import { prisma } from "@/lib/db";
import { asEnum, PROJECT_ROLES, type ProjectRole } from "@/lib/enums";
import { parseShape, type TemplateShape } from "@/lib/templates";
import type { SessionUser } from "@/lib/auth";

/**
 * Control de acceso por proyecto.
 *
 * Un proyecto solo es visible para sus miembros. Un ADMIN de la plataforma ve
 * todo, porque es quien administra la instancia — pero se le asigna el rol
 * OWNER efectivo para que la UI sea coherente.
 */

export type ProjectAccess = {
  role: ProjectRole;
  isPlatformAdmin: boolean;
};

export async function getProjectRole(
  user: SessionUser,
  projectId: string,
): Promise<ProjectAccess | null> {
  if (user.role === "ADMIN") return { role: "OWNER", isPlatformAdmin: true };

  const membership = await prisma.membership.findUnique({
    where: { projectId_userId: { projectId, userId: user.id } },
  });

  if (!membership) return null;
  return {
    role: asEnum(PROJECT_ROLES, membership.role, "VIEWER"),
    isPlatformAdmin: false,
  };
}

/** Proyecto + rol del usuario. 404 si no existe o no tiene acceso. */
export async function requireProject(user: SessionUser, slug: string) {
  const project = await prisma.project.findUnique({
    where: { slug },
    include: { brief: true },
  });
  if (!project) notFound();

  const access = await getProjectRole(user, project.id);
  if (!access) notFound();

  return { project, ...access };
}

/** Proyectos visibles para el usuario, con conteos para la lista. */
export async function listProjectsFor(user: SessionUser) {
  // La papelera se consulta aparte: un proyecto tirado no debe aparecer en la
  // lista de trabajo.
  const where =
    user.role === "ADMIN"
      ? { status: { not: "TRASHED" } }
      : { status: { not: "TRASHED" }, members: { some: { userId: user.id } } };

  return prisma.project.findMany({
    where,
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    include: {
      _count: { select: { members: true, openQuestions: true } },
      maps: {
        select: {
          id: true,
          _count: { select: { fragments: true } },
        },
      },
    },
  });
}

/** Proyectos en la papelera, con cuanto trabajo se perderia al vaciarla. */
export async function listTrashedProjects(user: SessionUser) {
  const where =
    user.role === "ADMIN"
      ? { status: "TRASHED" }
      : { status: "TRASHED", members: { some: { userId: user.id } } };

  return prisma.project.findMany({
    where,
    orderBy: { trashedAt: "desc" },
    include: {
      _count: { select: { sources: true, openQuestions: true } },
      maps: { select: { _count: { select: { fragments: true } } } },
    },
  });
}

/** El mapa principal del proyecto, con su plantilla resuelta. */
export async function getPrimaryMap(projectId: string) {
  const map = await prisma.bomMap.findFirst({
    where: { projectId },
    orderBy: { createdAt: "asc" },
    include: { template: true },
  });
  if (!map) return null;

  const shape: TemplateShape = parseShape(map.template.rows, map.template.cols);
  return { map, shape };
}

/**
 * Convierte un nombre en un slug legible.
 *
 * El recorte va ANTES de quitar los guiones de los extremos. Al reves —que es
 * como estaba— cortar a 48 caracteres puede caer en mitad de una palabra y
 * dejar un guion colgando: "Cabot Cartagena (v2)" salia como
 * "...-cabot-cartagena-prueba-". Ademas se corta en el ultimo guion completo
 * para no partir palabras.
 */
export function slugify(name: string, max = 48): string {
  const limpio = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // quita tildes
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (limpio.length <= max) return limpio || "proyecto";

  const cortado = limpio.slice(0, max);
  const ultimoGuion = cortado.lastIndexOf("-");
  const final = ultimoGuion > max / 2 ? cortado.slice(0, ultimoGuion) : cortado;
  return final.replace(/-+$/g, "") || "proyecto";
}

/** Genera un slug unico a partir del nombre del proyecto. */
export async function uniqueSlug(name: string): Promise<string> {
  const base = slugify(name);

  let slug = base;
  let n = 2;
  while (await prisma.project.findUnique({ where: { slug } })) {
    slug = `${base}-${n++}`;
  }
  return slug;
}
