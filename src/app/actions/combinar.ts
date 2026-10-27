"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canEdit } from "@/lib/enums";
import { getProjectRole, getPrimaryMap } from "@/lib/projects";
import { chat } from "@/lib/agent/openrouter";
import { resolveModel } from "@/lib/agent/run";
import { extractJsonBlock } from "@/lib/agent/schema";
import { claveDelAgente } from "@/lib/claveAgente";

/**
 * Lienzo de concepto (v2, mentor 15-oct-2026): se toman post-its del mapa, uno
 * o varios por dimensión, y se juntan en un concepto. Anclar no mueve ni copia
 * el post-it: lo enlaza (ConceptFragment), así que soltarlo lo «devuelve» al
 * mapa sin perder nada. Las acciones devuelven el error en vez de lanzarlo
 * porque en producción Next oculta el mensaje de las excepciones.
 */

type Resultado<T = object> = ({ ok: true } & T) | { ok: false; error: string };

async function guardProyecto(slug: string) {
  const user = await requireUser();
  const project = await prisma.project.findUnique({ where: { slug }, select: { id: true, slug: true, agentModel: true } });
  if (!project) return null;
  const access = await getProjectRole(user, project.id);
  if (!canEdit(access?.role)) return null;
  return { user, project };
}

async function guardConcepto(conceptId: string) {
  const user = await requireUser();
  const concept = await prisma.concept.findUnique({
    where: { id: conceptId },
    include: { project: { select: { id: true, slug: true, agentModel: true } } },
  });
  if (!concept) return null;
  const access = await getProjectRole(user, concept.project.id);
  if (!canEdit(access?.role)) return null;
  return { user, concept };
}

function refrescar(slug: string) {
  revalidatePath(`/proyectos/${slug}/combinar`);
  revalidatePath(`/proyectos/${slug}/convergir`);
  revalidatePath(`/proyectos/${slug}`);
}

const SIN_PERMISO = { ok: false as const, error: "No tienes permiso para editar este proyecto." };

export async function crearConcepto(slug: string): Promise<Resultado<{ id: string }>> {
  const g = await guardProyecto(slug);
  if (!g) return SIN_PERMISO;
  const n = await prisma.concept.count({ where: { projectId: g.project.id } });
  const ultimo = await prisma.concept.findFirst({
    where: { projectId: g.project.id },
    orderBy: { position: "desc" },
    select: { position: true },
  });
  // Los conceptos se arman en torno a la plataforma priorizada (IMBOK p. 61).
  const plataforma = await prisma.plataforma.findFirst({ where: { projectId: g.project.id, priorizada: true }, select: { id: true } });
  const c = await prisma.concept.create({
    data: {
      projectId: g.project.id,
      authorId: g.user.id,
      plataformaId: plataforma?.id ?? null,
      title: `Concepto ${n + 1}`,
      position: (ultimo?.position ?? -1) + 1,
    },
    select: { id: true },
  });
  refrescar(slug);
  return { ok: true, id: c.id };
}

export async function anclarPostit(conceptId: string, fragmentId: string, rowId: string): Promise<Resultado> {
  const g = await guardConcepto(conceptId);
  if (!g) return SIN_PERMISO;
  const f = await prisma.fragment.findFirst({
    where: { id: fragmentId, map: { projectId: g.concept.project.id } },
    select: { id: true, text: true, titulo: true },
  });
  if (!f) return { ok: false, error: "Ese post-it no es de este proyecto." };
  const ultimo = await prisma.conceptFragment.findFirst({
    where: { conceptId },
    orderBy: { position: "desc" },
    select: { position: true },
  });
  await prisma.conceptFragment.upsert({
    where: { conceptId_fragmentId: { conceptId, fragmentId } },
    create: { conceptId, fragmentId, rowId, textSnapshot: f.text, position: (ultimo?.position ?? -1) + 1 },
    update: { rowId },
  });
  refrescar(g.concept.project.slug);
  return { ok: true };
}

export async function soltarPostit(conceptId: string, fragmentId: string): Promise<Resultado> {
  const g = await guardConcepto(conceptId);
  if (!g) return SIN_PERMISO;
  await prisma.conceptFragment.deleteMany({ where: { conceptId, fragmentId } });
  refrescar(g.concept.project.slug);
  return { ok: true };
}

export async function guardarConcepto(
  conceptId: string,
  campos: { title: string; statement: string; propuestaValor?: string },
): Promise<Resultado> {
  const g = await guardConcepto(conceptId);
  if (!g) return SIN_PERMISO;
  const title = campos.title.trim().slice(0, 120);
  if (!title) return { ok: false, error: "El concepto necesita un nombre." };
  await prisma.concept.update({
    where: { id: conceptId },
    data: {
      title,
      statement: campos.statement.trim(),
      ...(typeof campos.propuestaValor === "string" ? { propuestaValor: campos.propuestaValor.trim() } : {}),
    },
  });
  refrescar(g.concept.project.slug);
  return { ok: true };
}

/** Cambia la plataforma de crecimiento en torno a la que está el concepto. */
export async function asignarPlataforma(conceptId: string, plataformaId: string | null): Promise<Resultado> {
  const g = await guardConcepto(conceptId);
  if (!g) return SIN_PERMISO;
  if (plataformaId) {
    const ok = await prisma.plataforma.count({ where: { id: plataformaId, projectId: g.concept.project.id } });
    if (!ok) return { ok: false, error: "Esa plataforma no es de este proyecto." };
  }
  await prisma.concept.update({ where: { id: conceptId }, data: { plataformaId } });
  refrescar(g.concept.project.slug);
  return { ok: true };
}

export async function borrarConcepto(conceptId: string): Promise<Resultado> {
  const g = await guardConcepto(conceptId);
  if (!g) return SIN_PERMISO;
  await prisma.concept.delete({ where: { id: conceptId } });
  refrescar(g.concept.project.slug);
  return { ok: true };
}

const SISTEMA_CONCEPTO = `Ayudas a un equipo de innovación a redactar un concepto de negocio a partir de los post-its que juntó de su Mapa de Oportunidades.
Escribe UNA frase con la estructura «Conecte los puntos»: «Ofreceremos [oferta] a [cliente], que necesita [necesidad], entregado a través de [canal], producido por [cómo se produce], y generamos dinero mediante [modelo]».
Reglas:
- Usa solo lo que dicen los post-its. Si a una dimensión no le llegó ningún post-it, deja el hueco entre corchetes para que el equipo lo complete, por ejemplo «[canal por definir]».
- Concreta, en español, sin adjetivos de relleno.
- Propón también un nombre corto para el concepto (2 a 5 palabras).
Responde SOLO un objeto JSON: {"nombre": "...", "frase": "..."}`;

/**
 * Borrador de la frase del concepto con IA. No guarda nada: devuelve el texto
 * para que el equipo lo lea, lo corrija y decida si lo guarda.
 */
export async function redactarConcepto(conceptId: string): Promise<Resultado<{ nombre: string; frase: string }>> {
  const g = await guardConcepto(conceptId);
  if (!g) return SIN_PERMISO;

  const anclas = await prisma.conceptFragment.findMany({
    where: { conceptId },
    orderBy: { position: "asc" },
    include: { fragment: { select: { text: true } } },
  });
  if (anclas.length === 0) return { ok: false, error: "Primero junten algunos post-its en el concepto." };

  const primary = await getPrimaryMap(g.concept.project.id);
  const nombreFila = (id: string) => primary?.shape.rows.find((r) => r.id === id)?.name ?? id;

  let clave: string;
  try {
    ({ clave } = await claveDelAgente(g.user.id));
  } catch {
    return { ok: false, error: "Falta tu clave de IA: ponla en Cuenta." };
  }

  try {
    const r = await chat({
      model: resolveModel(g.concept.project.agentModel),
      apiKey: clave,
      system: SISTEMA_CONCEPTO,
      user: anclas.map((a) => `${nombreFila(a.rowId)}: ${(a.fragment?.text ?? a.textSnapshot).replace(/\s+/g, " ")}`).join("\n"),
      maxTokens: 800,
      webSearch: false,
    });
    const datos = JSON.parse(extractJsonBlock(r.text) ?? "{}") as { nombre?: unknown; frase?: unknown };
    if (typeof datos.frase !== "string" || !datos.frase.trim()) throw new Error("vacío");
    return { ok: true, nombre: typeof datos.nombre === "string" ? datos.nombre.trim() : "", frase: datos.frase.trim() };
  } catch {
    return { ok: false, error: "La IA no respondió bien. Inténtalo de nuevo en un momento." };
  }
}
