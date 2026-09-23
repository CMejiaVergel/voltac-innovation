import "server-only";

import { prisma } from "@/lib/db";
import { fraseConectada, tipoDeConcepto, TIPOS_CONCEPTO } from "@/lib/gimi";
import { parseShape } from "@/lib/templates";
import type { DatosPromptArtefacto } from "@/lib/promptArtefacto";

function json<T>(s: string, fallback: T): T {
  try {
    return JSON.parse(s || "") as T;
  } catch {
    return fallback;
  }
}

/**
 * Reune todo lo que el prompt de un artefacto necesita de un concepto: el
 * reto, la frase y el lienzo, los fragmentos del mapa que lo sostienen (los
 * unicos hechos citables), los insights de origen y la ingenieria inversa.
 * Devuelve null si el concepto no existe.
 */
export async function datosPromptArtefacto(conceptId: string): Promise<DatosPromptArtefacto | null> {
  const c = await prisma.concept.findUnique({
    where: { id: conceptId },
    include: {
      project: {
        select: {
          id: true,
          name: true,
          company: true,
          program: true,
          brief: { select: { challengeText: true, meta: true, queEvitar: true } },
        },
      },
      origenes: { select: { insightId: true } },
      supuestos: { orderBy: [{ likelihood: "asc" }, { position: "asc" }] },
      anclas: {
        orderBy: { position: "asc" },
        include: {
          fragment: {
            select: {
              id: true,
              text: true,
              colId: true,
              reviewState: true,
              hidden: true,
              verification: true,
              sourceUrl: true,
              sourceCitation: true,
            },
          },
        },
      },
    },
  });
  if (!c) return null;

  const mapa = await prisma.bomMap.findFirst({
    where: { projectId: c.project.id },
    orderBy: { createdAt: "asc" },
    select: { template: { select: { rows: true, cols: true } } },
  });
  const filas = mapa ? parseShape(mapa.template.rows, mapa.template.cols).rows : [];
  const nombreFila = (id: string) => filas.find((f) => f.id === id)?.name ?? id;

  const vivas = c.anclas.filter((a) => a.fragment && a.fragment.reviewState === "ACCEPTED" && !a.fragment.hidden);
  const tipo = tipoDeConcepto(vivas.map((a) => a.fragment!.colId));

  // Insights de origen, numerados como en Combinar.
  const insightsProyecto = await prisma.insight.findMany({
    where: { projectId: c.project.id, reviewState: "ACCEPTED", hidden: false },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    select: { id: true, statement: true, pattern: true, fact: true, implication: true },
  });
  const deOrigen = new Set(c.origenes.map((o) => o.insightId));

  const lienzo = json<Record<string, string[]>>(c.lienzo, {});
  const condiciones = c.supuestos.filter((s) => s.kind !== "PRECEDENTE");

  return {
    proyecto: {
      nombre: c.project.name,
      empresa: c.project.company ?? "",
      programa: c.project.program ?? "",
      reto: c.project.brief?.challengeText ?? "",
      meta: c.project.brief?.meta ?? "",
      queEvitar: json<string[]>(c.project.brief?.queEvitar ?? "[]", []),
    },
    concepto: {
      titulo: c.title,
      frase: fraseConectada(c) || c.statement,
      propuestaValor: c.propuestaValor,
      tipo: tipo ? `${TIPOS_CONCEPTO[tipo].label} — ${TIPOS_CONCEPTO[tipo].definicion}` : "",
      lienzo: filas.map((f) => ({ dimension: f.name, vinetas: lienzo[f.id] ?? [] })),
    },
    hechos: vivas.map((a) => ({
      id: a.fragment!.id,
      dimension: nombreFila(a.rowId),
      texto: a.fragment!.text,
      fuente: a.fragment!.sourceCitation || a.fragment!.sourceUrl || "",
      verificado: a.fragment!.verification === "VERIFIED",
    })),
    insights: insightsProyecto
      .map((i, n) => ({ ...i, numero: n + 1 }))
      .filter((i) => deOrigen.has(i.id))
      .map((i) => ({
        numero: i.numero,
        patron: i.pattern || i.statement,
        hecho: i.fact,
        implicacion: i.implication,
      })),
    condiciones: {
      criticas: condiciones
        .filter((s) => s.critical)
        .map((s) => ({ texto: s.text, prueba: s.failFastTest, resultado: s.expectedResult })),
      otras: condiciones.filter((s) => !s.critical).map((s) => s.text),
      precedentes: c.supuestos.filter((s) => s.kind === "PRECEDENTE").map((s) => s.text),
    },
  };
}
