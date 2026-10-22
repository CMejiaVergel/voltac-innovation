"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canEdit } from "@/lib/enums";
import { getProjectRole } from "@/lib/projects";
import { chat } from "@/lib/agent/openrouter";
import { resolveModel } from "@/lib/agent/run";
import { extractJsonBlock } from "@/lib/agent/schema";
import { claveDelAgente } from "@/lib/claveAgente";

/** Cuántos post-its se titulan por pasada: cabe holgado en una respuesta. */
const POR_PASADA = 80;

const SISTEMA = `Ayudas a un equipo de innovación a leer su Mapa de Oportunidades como un tablero de post-its.
Para cada fragmento escribe un título de 2 a 5 palabras, como se escribiría en un post-it.
Reglas:
- Sustantivos concretos; conserva nombres propios, siglas y la cifra clave si la hay.
- Nada que no esté en el texto. No opines ni resumas la implicación.
- En español, sin punto final.
Responde SOLO un objeto JSON: {"p1": "título", "p2": "título", ...}`;

/**
 * Sugiere títulos cortos para los post-its que aún no tienen uno (mentor,
 * 15-oct-2026: «un título corto para cada fragmento, generado por IA»). Es una
 * ayuda puntual: escribe solo donde el título está vacío, el texto completo no
 * se toca y cada título queda editable. Devuelve el error en vez de lanzarlo
 * porque en producción Next oculta el mensaje de las excepciones.
 */
export async function sugerirTitulos(mapId: string): Promise<{ hechos: number; faltan: number; error?: string }> {
  const user = await requireUser();
  const map = await prisma.bomMap.findUnique({
    where: { id: mapId },
    include: { project: { select: { id: true, slug: true, agentModel: true } } },
  });
  if (!map) return { hechos: 0, faltan: 0, error: "El mapa no existe." };
  const access = await getProjectRole(user, map.project.id);
  if (!canEdit(access?.role)) return { hechos: 0, faltan: 0, error: "No tienes permiso para editar este mapa." };

  const sinTitulo = await prisma.fragment.findMany({
    where: { mapId, reviewState: "ACCEPTED", hidden: false, titulo: "" },
    orderBy: [{ rowId: "asc" }, { colId: "asc" }, { position: "asc" }],
    select: { id: true, text: true },
  });
  if (sinTitulo.length === 0) return { hechos: 0, faltan: 0 };
  const lote = sinTitulo.slice(0, POR_PASADA);

  let clave: string;
  try {
    ({ clave } = await claveDelAgente(user.id));
  } catch {
    return { hechos: 0, faltan: sinTitulo.length, error: "Falta tu clave de IA: ponla en Cuenta." };
  }

  let titulos: Record<string, unknown>;
  try {
    const r = await chat({
      model: resolveModel(map.project.agentModel),
      apiKey: clave,
      system: SISTEMA,
      user: lote.map((f, i) => `p${i + 1}: ${f.text.replace(/\s+/g, " ").slice(0, 600)}`).join("\n"),
      maxTokens: 4000,
      webSearch: false,
    });
    titulos = JSON.parse(extractJsonBlock(r.text) ?? "{}");
  } catch {
    return { hechos: 0, faltan: sinTitulo.length, error: "La IA no respondió bien. Inténtalo de nuevo en un momento." };
  }

  let hechos = 0;
  for (const [i, f] of lote.entries()) {
    const t = titulos[`p${i + 1}`];
    if (typeof t !== "string" || !t.trim()) continue;
    const titulo = t.trim().replace(/\.$/, "").slice(0, 80);
    await prisma.fragment.update({ where: { id: f.id }, data: { titulo } });
    await prisma.fragmentRevision.create({
      data: { mapId, fragmentId: f.id, action: "EDIT", note: `Título sugerido por IA: ${titulo}`, editedById: user.id },
    });
    hechos++;
  }

  revalidatePath(`/proyectos/${map.project.slug}/divergir`);
  return { hechos, faltan: sinTitulo.length - hechos };
}
