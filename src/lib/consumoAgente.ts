import "server-only";

import { prisma } from "@/lib/db";

/**
 * Lo que ESTA plataforma ha gastado, por persona.
 *
 * Complementa el saldo que devuelve OpenRouter, y no lo sustituye: el saldo
 * dice cuanto queda, esto dice en que se fue. Son las dos preguntas que uno se
 * hace antes de lanzar otra corrida — "¿me alcanza?" y "¿que me esta saliendo
 * caro?" — y la segunda no se puede responder desde OpenRouter, porque alli
 * todo el trafico de la plataforma se ve igual.
 *
 * Solo cuenta corridas del agente investigador: son las que dejan fila en
 * ResearchRun. Las de Combinar no crean corrida y su coste no se registra
 * todavia, asi que el total local es un PISO, no la cifra exacta. Se dice en
 * pantalla en vez de fingir precision.
 */
export async function consumoDe(userId: string) {
  const runs = await prisma.researchRun.findMany({
    where: { requestedById: userId },
    orderBy: { startedAt: "desc" },
    select: {
      id: true,
      status: true,
      model: true,
      inputTokens: true,
      outputTokens: true,
      webSearches: true,
      costUsd: true,
      startedAt: true,
      finishedAt: true,
      error: true,
      project: { select: { name: true, slug: true } },
      _count: { select: { fragments: true } },
    },
  });

  const porModelo = new Map<
    string,
    { corridas: number; costo: number; tokens: number; busquedas: number; sinCosto: number }
  >();

  for (const r of runs) {
    const clave = r.model || "(sin registrar)";
    const acc = porModelo.get(clave) ?? {
      corridas: 0,
      costo: 0,
      tokens: 0,
      busquedas: 0,
      sinCosto: 0,
    };
    acc.corridas += 1;
    acc.tokens += r.inputTokens + r.outputTokens;
    acc.busquedas += r.webSearches;
    // OpenRouter no siempre devuelve el coste. Contarlo como cero mentiria por
    // abajo, asi que se cuenta aparte y se avisa.
    if (typeof r.costUsd === "number") acc.costo += r.costUsd;
    else acc.sinCosto += 1;
    porModelo.set(clave, acc);
  }

  const modelos = [...porModelo.entries()]
    .map(([modelo, v]) => ({ modelo, ...v }))
    .sort((a, b) => b.costo - a.costo);

  const total = modelos.reduce((a, m) => a + m.costo, 0);
  const corridasSinCosto = modelos.reduce((a, m) => a + m.sinCosto, 0);

  const ahora = Date.now();
  const desde30 = ahora - 30 * 24 * 60 * 60 * 1000;
  const ultimos30 = runs
    .filter((r) => r.startedAt.getTime() >= desde30 && typeof r.costUsd === "number")
    .reduce((a, r) => a + (r.costUsd ?? 0), 0);

  return {
    total,
    ultimos30,
    corridas: runs.length,
    corridasSinCosto,
    conError: runs.filter((r) => r.status === "ERROR").length,
    modelos,
    recientes: runs.slice(0, 12).map((r) => ({
      id: r.id,
      estado: r.status,
      modelo: r.model || "(sin registrar)",
      proyecto: r.project.name,
      slug: r.project.slug,
      tokens: r.inputTokens + r.outputTokens,
      busquedas: r.webSearches,
      costo: r.costUsd,
      fragmentos: r._count.fragments,
      cuando: r.startedAt.toISOString(),
      error: r.error,
    })),
  };
}

export type Consumo = Awaited<ReturnType<typeof consumoDe>>;
