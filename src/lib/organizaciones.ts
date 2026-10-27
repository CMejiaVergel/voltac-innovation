import "server-only";

import { notFound } from "next/navigation";

import { prisma } from "@/lib/db";
import { asEnum, PROJECT_ROLES, type ProjectRole } from "@/lib/enums";
import { slugify } from "@/lib/projects";
import type { SessionUser } from "@/lib/auth";

/**
 * Acceso por organizacion. Mismas reglas que los proyectos: la ven sus
 * miembros; el ADMIN de la plataforma la ve toda como responsable.
 */
export async function getOrgRole(user: SessionUser, organizacionId: string): Promise<ProjectRole | null> {
  if (user.soloProyectoId && user.soloOrganizacionId !== organizacionId) return null;
  if (user.role === "ADMIN") return "OWNER";
  const m = await prisma.orgMembership.findUnique({
    where: { organizacionId_userId: { organizacionId, userId: user.id } },
  });
  return m ? asEnum(PROJECT_ROLES, m.role, "VIEWER") : null;
}

export async function requireOrg(user: SessionUser, slug: string) {
  const org = await prisma.organizacion.findUnique({
    where: { slug },
    include: { perfil: true },
  });
  if (!org) notFound();
  const role = await getOrgRole(user, org.id);
  if (!role) notFound();
  return { org, role };
}

export async function listOrgsFor(user: SessionUser) {
  return prisma.organizacion.findMany({
    where: user.soloProyectoId
      ? { id: user.soloOrganizacionId ?? "" }
      : user.role === "ADMIN"
        ? {}
        : { miembros: { some: { userId: user.id } } },
    orderBy: { updatedAt: "desc" },
    include: {
      perfil: true,
      _count: { select: { desafios: true, proyectos: true, miembros: true } },
    },
  });
}

export async function uniqueOrgSlug(name: string): Promise<string> {
  const base = slugify(name);
  let slug = base;
  let n = 2;
  while (await prisma.organizacion.findUnique({ where: { slug } })) slug = `${base}-${n++}`;
  return slug;
}

/** Lee un JSON guardado como texto sin romper la página si está mal formado. */
export function leerJson<T>(raw: string | null | undefined, porDefecto: T): T {
  if (!raw) return porDefecto;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return porDefecto;
  }
}

/** Qué pasos de Configurar ya están hechos en una organización. */
export async function avanceConfigurar(org: { id: string; perfil: { definicion: string; brechaCuanto: string } | null }) {
  const [desafios, seleccionados, retos] = await Promise.all([
    prisma.desafioPropuesto.count({ where: { organizacionId: org.id } }),
    prisma.desafioPropuesto.count({ where: { organizacionId: org.id, estado: "SELECCIONADO" } }),
    prisma.project.count({ where: { organizacionId: org.id } }),
  ]);
  const p = org.perfil;
  return {
    perfil: Boolean(p?.definicion && p.brechaCuanto),
    desafios: desafios > 0,
    seleccion: seleccionados > 0,
    reto: retos > 0,
  } as Record<string, boolean>;
}
