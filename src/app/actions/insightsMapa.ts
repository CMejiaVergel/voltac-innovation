"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canEdit, DOTS_MINIMO } from "@/lib/enums";
import { getProjectRole } from "@/lib/projects";

/**
 * Insights sobre el propio mapa (v2).
 *
 * El insight no es una etapa aparte: es el ejercicio que se hace sobre el
 * mapa mientras se llena (mentor, 15-oct-2026: «eso realmente debería estar en
 * el mapa de oportunidades»; IMBOK p. 37: el propósito del mapa es encontrar
 * los insights). El equipo toca los post-its que se conectan y escribe lo que
 * descubrió. Se reutiliza el modelo `Insight` de la v1, así que los insights
 * de antes aparecen en el mapa con sus puntos.
 *
 * Devuelven el error en vez de lanzarlo porque en producción Next oculta el
 * mensaje de las excepciones.
 */

type Resultado<T = object> = ({ ok: true } & T) | { ok: false; error: string };

export type CamposInsightMapa = {
  statement: string;
  fact: string;
  pattern: string;
  implication: string;
  business: string;
  limitNote: string;
};

async function guardProyecto(slug: string) {
  const user = await requireUser();
  const project = await prisma.project.findUnique({ where: { slug }, select: { id: true } });
  if (!project) return null;
  const access = await getProjectRole(user, project.id);
  if (!canEdit(access?.role)) return null;
  return { userId: user.id, projectId: project.id };
}

function limpiar(c: Partial<CamposInsightMapa>) {
  return {
    statement: (c.statement ?? "").trim(),
    fact: (c.fact ?? "").trim(),
    pattern: (c.pattern ?? "").trim(),
    implication: (c.implication ?? "").trim(),
    business: (c.business ?? "").trim(),
    limitNote: (c.limitNote ?? "").trim(),
  };
}

/**
 * Crea o actualiza un insight con los post-its que lo sostienen. Los puntos se
 * sincronizan: entran los nuevos, salen los que el equipo soltó.
 */
export async function guardarInsightMapa(
  slug: string,
  datos: { id?: string; fragmentIds: string[]; campos: Partial<CamposInsightMapa> },
): Promise<Resultado<{ id: string }>> {
  const g = await guardProyecto(slug);
  if (!g) return { ok: false, error: "No tienes permiso para editar este proyecto." };

  const campos = limpiar(datos.campos);
  if (!campos.statement) return { ok: false, error: "Escriba el insight en una frase." };

  const ids = [...new Set(datos.fragmentIds)];
  if (ids.length < DOTS_MINIMO) {
    return { ok: false, error: `Un insight conecta al menos ${DOTS_MINIMO} post-its del mapa.` };
  }
  const fragmentos = await prisma.fragment.findMany({
    where: { id: { in: ids }, map: { projectId: g.projectId } },
    select: { id: true, text: true, rowId: true, colId: true },
  });
  if (fragmentos.length !== ids.length) return { ok: false, error: "Algún post-it ya no está en el mapa." };
  const orden = new Map(ids.map((id, i) => [id, i]));
  const punto = (f: (typeof fragmentos)[number]) => ({
    fragmentId: f.id,
    textSnapshot: f.text,
    rowId: f.rowId,
    colId: f.colId,
    position: orden.get(f.id) ?? 0,
  });

  if (!datos.id) {
    const ultimo = await prisma.insight.findFirst({
      where: { projectId: g.projectId },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    const creado = await prisma.insight.create({
      data: {
        projectId: g.projectId,
        authorId: g.userId,
        origin: "HUMAN",
        ...campos,
        position: (ultimo?.position ?? -1) + 1,
        dots: { create: fragmentos.map(punto) },
      },
      select: { id: true },
    });
    revalidatePath(`/proyectos/${slug}/divergir`);
    return { ok: true, id: creado.id };
  }

  const actual = await prisma.insight.findFirst({
    where: { id: datos.id, projectId: g.projectId },
    include: { dots: { select: { id: true, fragmentId: true } } },
  });
  if (!actual) return { ok: false, error: "Ese insight ya no existe." };

  const quedan = new Set(ids);
  const yaEstan = new Set(actual.dots.map((d) => d.fragmentId));
  await prisma.$transaction([
    prisma.insight.update({ where: { id: actual.id }, data: campos }),
    // Solo se sueltan puntos con post-it vivo: un punto huérfano es la huella
    // de un post-it borrado y se queda para que el equipo lo note.
    prisma.insightDot.deleteMany({
      where: { insightId: actual.id, fragmentId: { not: null, notIn: ids } },
    }),
    ...fragmentos
      .filter((f) => !yaEstan.has(f.id))
      .map((f) => prisma.insightDot.create({ data: { insightId: actual.id, ...punto(f) } })),
    ...actual.dots
      .filter((d) => d.fragmentId && quedan.has(d.fragmentId))
      .map((d) => prisma.insightDot.update({ where: { id: d.id }, data: { position: orden.get(d.fragmentId!) ?? 0 } })),
  ]);
  revalidatePath(`/proyectos/${slug}/divergir`);
  return { ok: true, id: actual.id };
}

/** Lo saca del mapa sin borrarlo, igual que un post-it oculto. */
export async function ocultarInsightMapa(slug: string, id: string): Promise<Resultado> {
  const g = await guardProyecto(slug);
  if (!g) return { ok: false, error: "No tienes permiso para editar este proyecto." };
  const r = await prisma.insight.updateMany({ where: { id, projectId: g.projectId }, data: { hidden: true } });
  if (r.count === 0) return { ok: false, error: "Ese insight ya no existe." };
  revalidatePath(`/proyectos/${slug}/divergir`);
  return { ok: true };
}
