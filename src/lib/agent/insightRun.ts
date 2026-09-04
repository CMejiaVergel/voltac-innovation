import "server-only";

import { prisma } from "@/lib/db";
import { extractJsonBlock } from "@/lib/agent/schema";
import { chat } from "@/lib/agent/openrouter";
import { resolveModel } from "@/lib/agent/run";
import {
  buildInsightSystemPrompt,
  buildInsightUserPrompt,
  InsightOutputSchema,
  type InsightScope,
  type PuntoDisponible,
} from "@/lib/agent/insightPrompt";
import { parseShape } from "@/lib/templates";
import { claveDelAgente } from "@/lib/claveAgente";

/**
 * Genera insights con el modelo, sobre los fragmentos que el equipo ya acepto.
 *
 * A diferencia del agente investigador, esto NO busca en la web: combinar es
 * leer el mapa, no ampliarlo. Un hecho traido de fuera aqui se colaria sin
 * pasar por la verificacion del equipo.
 *
 * Los insights entran como PROPOSED. Nada del modelo llega al tablero sin que
 * una persona lo acepte, igual que con los fragmentos.
 */
export async function generateInsights(params: {
  projectId: string;
  userId: string;
  scope: InsightScope;
}): Promise<{ creados: number; descartados: string[]; notas: string; costUsd: number | null }> {
  const project = await prisma.project.findUniqueOrThrow({
    where: { id: params.projectId },
    include: { brief: true, maps: { include: { template: true } } },
  });

  const map = project.maps[0];
  if (!map) throw new Error("El proyecto no tiene un mapa.");

  const shape = parseShape(map.template.rows, map.template.cols);

  const fragmentos = await prisma.fragment.findMany({
    where: { mapId: map.id, reviewState: "ACCEPTED", hidden: false },
    orderBy: [{ rowId: "asc" }, { colId: "asc" }, { position: "asc" }],
    select: { id: true, rowId: true, colId: true, text: true, verification: true },
  });

  if (fragmentos.length < 4) {
    throw new Error(
      "El mapa tiene muy pocos fragmentos aceptados para combinar. Llena Divergir primero.",
    );
  }

  // Referencias cortas: el modelo cita "p12" en vez de un cuid de 25
  // caracteres. Ahorra tokens y hace legible el bloque JSON al auditarlo.
  const puntos: PuntoDisponible[] = fragmentos.map((f, i) => ({
    ref: `p${i + 1}`,
    rowId: f.rowId,
    colId: f.colId,
    text: f.text,
    verification: f.verification,
  }));
  const porRef = new Map(puntos.map((p, i) => [p.ref, fragmentos[i]]));

  const existentes = await prisma.insight.findMany({
    where: { projectId: params.projectId },
    select: { statement: true },
  });

  const { clave } = await claveDelAgente(params.userId);

  const completion = await chat({
    model: resolveModel(project.agentModel),
    apiKey: clave,
    system: buildInsightSystemPrompt(shape),
    user: buildInsightUserPrompt(
      project,
      project.brief,
      puntos,
      shape,
      params.scope,
      existentes.map((e) => e.statement),
    ),
    maxTokens: 8000,
    // Combinar no busca: la fuente es el mapa y solo el mapa.
    webSearch: false,
    maxWebResults: 0,
  });

  const bloque = extractJsonBlock(completion.text);
  if (!bloque) throw new Error("El agente no devolvio un bloque JSON reconocible.");

  let crudo: unknown;
  try {
    crudo = JSON.parse(bloque);
  } catch (e) {
    throw new Error(`El bloque JSON del agente no es valido: ${(e as Error).message}`);
  }

  const validado = InsightOutputSchema.safeParse(crudo);
  if (!validado.success) {
    const issues = validado.error.issues
      .slice(0, 5)
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join(" | ");
    throw new Error(`La salida del agente no cumple el contrato. ${issues}`);
  }

  const descartados: string[] = [];
  let creados = 0;
  let posicion =
    ((
      await prisma.insight.findFirst({
        where: { projectId: params.projectId },
        orderBy: { position: "desc" },
        select: { position: true },
      })
    )?.position ?? -1) + 1;

  for (const item of validado.data.insights) {
    // Un ref inventado significa que el modelo cito un punto que no existe.
    // Se descarta el insight entero: si una de sus patas es imaginaria, no se
    // sostiene, y aceptarlo a medias seria peor que rechazarlo.
    const resueltos = item.puntos.map((p) => ({ dot: p, frag: porRef.get(p.ref) }));
    const invalidos = resueltos.filter((r) => !r.frag).map((r) => r.dot.ref);
    if (invalidos.length > 0) {
      descartados.push(`"${item.enunciado.slice(0, 60)}…" cita puntos inexistentes: ${invalidos.join(", ")}`);
      continue;
    }

    // Sin duplicar el mismo punto dentro del insight.
    const vistos = new Set<string>();
    const dots = resueltos.filter((r) => {
      if (vistos.has(r.frag!.id)) return false;
      vistos.add(r.frag!.id);
      return true;
    });

    await prisma.insight.create({
      data: {
        projectId: params.projectId,
        authorId: params.userId,
        origin: "AGENT",
        reviewState: "PROPOSED",
        position: posicion++,
        tag: (item.etiqueta ?? "").slice(0, 40),
        statement: item.enunciado,
        fact: item.hecho ?? "",
        counterpart: item.contraparte ?? "",
        shift: item.giro ?? "",
        offerWho: item.ofreceQuien ?? "",
        offerProof: item.ofrecePrueba ?? "",
        payWho: item.pagaQuien ?? "",
        payProof: item.pagaPrueba ?? "",
        business: item.negocio ?? "",
        limitNote: item.limite ?? "",
        dots: {
          create: dots.map((r, i) => ({
            fragmentId: r.frag!.id,
            textSnapshot: r.frag!.text,
            rowId: r.frag!.rowId,
            colId: r.frag!.colId,
            role: r.dot.papel,
            position: i,
          })),
        },
        ideas: {
          create: item.ideas.map((text, i) => ({ text, position: i, origin: "AGENT" })),
        },
      },
    });
    creados++;
  }

  return {
    creados,
    descartados,
    notas: validado.data.notas ?? "",
    costUsd: completion.costUsd,
  };
}
