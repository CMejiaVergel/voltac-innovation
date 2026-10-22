"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canEdit, SUBCRITERIOS } from "@/lib/enums";
import { getProjectRole } from "@/lib/projects";

/**
 * Convergir v2: el equipo puntúa cada concepto en Atractividad y Fit (Taller 3,
 * Ejercicio 2) y decide cuáles siguen adelante. La matriz orienta; la decisión
 * es del equipo, por eso «priorizado» es una marca explícita y no un cálculo.
 */

type Resultado = { ok: true } | { ok: false; error: string };

async function guard(conceptId: string) {
  const user = await requireUser();
  const concept = await prisma.concept.findUnique({
    where: { id: conceptId },
    select: { id: true, project: { select: { id: true, slug: true } } },
  });
  if (!concept) return null;
  const access = await getProjectRole(user, concept.project.id);
  return canEdit(access?.role) ? concept : null;
}

function refrescar(slug: string) {
  revalidatePath(`/proyectos/${slug}/convergir`);
  revalidatePath(`/proyectos/${slug}`);
}

/** Puntúa un subcriterio de 1 a 5; 0 lo deja sin puntuar. */
export async function puntuar(conceptId: string, campo: string, valor: number): Promise<Resultado> {
  const c = await guard(conceptId);
  if (!c) return { ok: false, error: "No tienes permiso para editar este proyecto." };
  if (!SUBCRITERIOS.some((s) => s.campo === campo)) return { ok: false, error: "Ese criterio no existe." };
  const n = Math.round(valor);
  if (n < 0 || n > 5) return { ok: false, error: "La escala va de 1 a 5." };
  await prisma.concept.update({ where: { id: c.id }, data: { [campo]: n } });
  refrescar(c.project.slug);
  return { ok: true };
}

export async function marcarPriorizado(conceptId: string, priorizado: boolean): Promise<Resultado> {
  const c = await guard(conceptId);
  if (!c) return { ok: false, error: "No tienes permiso para editar este proyecto." };
  await prisma.concept.update({ where: { id: c.id }, data: { priorizado } });
  refrescar(c.project.slug);
  return { ok: true };
}
