"use client";

import { useState } from "react";

import {
  BROCHURE,
  INSIGHTS_DE_ARTEFACTO,
  ITERACIONES_ARTEFACTO,
  MATRIZ_ARTEFACTOS,
  promptBrochure,
  promptMockup,
} from "@/lib/gimi";
import { ARTIFACT_KIND_LABEL, type ArtifactKind } from "@/lib/enums";
import type { ConceptoOpcion } from "./types";

/**
 * La guia del Taller 3 para la etapa Actuar, en tres pestañas:
 *
 *   Que valida cada artefacto   la matriz de la lamina 32 y el ciclo de siete vueltas
 *   Brochure y protocepto       las cinco secciones y las preguntas por dimension
 *   Producir con IA             los prompts del taller, llenos con el concepto
 *
 * Esta todo aqui para que el taller se pueda repetir sin las laminas a la mano.
 */
export function GuiaTaller({ conceptos }: { conceptos: ConceptoOpcion[] }) {
  const [pestaña, setPestaña] = useState<"matriz" | "brochure" | "ia" | null>(null);
  const [conceptId, setConceptId] = useState(conceptos[0]?.id ?? "");
  const [copiado, setCopiado] = useState<string | null>(null);

  const concepto = conceptos.find((c) => c.id === conceptId) ?? null;
  const datos = concepto
    ? { titulo: concepto.title, frase: concepto.frase || concepto.statement, propuestaValor: concepto.propuestaValor }
    : null;

  async function copiar(clave: string, texto: string) {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(clave);
      setTimeout(() => setCopiado(null), 1800);
    } catch {
      setCopiado(null);
    }
  }

  const PESTAÑAS = [
    { key: "matriz", label: "Qué valida cada artefacto" },
    { key: "brochure", label: "Brochure y protocepto" },
    { key: "ia", label: "Producir con IA" },
  ] as const;

  return (
    <div className="panel flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="kicker">Guía del taller</p>
        <span className="flex-1" />
        {PESTAÑAS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => setPestaña((v) => (v === p.key ? null : p.key))}
            className={`rounded-[3px] border px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-wider transition ${
              pestaña === p.key
                ? "border-[rgba(111,191,178,0.6)] text-accent"
                : "border-[rgba(232,227,216,0.18)] text-[#8b9a97] hover:text-accent"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {pestaña === "matriz" && (
        <div className="flex flex-col gap-4">
          <p className="max-w-[72ch] text-[12.5px] leading-relaxed text-[#a9b5b3]">
            Construir, probar e iterar artefactos de negocio para ganar insights reales acerca del
            negocio y tener alineación con todos los integrantes de la cadena de valor. Se empieza
            con un brochure para ir rápido, validar y encontrar los aliados adecuados.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-[11.5px]">
              <thead>
                <tr>
                  <th className="px-2 py-1.5 text-left font-normal text-[#8b9a97]">Artefacto</th>
                  {INSIGHTS_DE_ARTEFACTO.map((i) => (
                    <th key={i} className="px-1.5 py-1.5 text-center font-normal text-[#8b9a97]">
                      {i}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(MATRIZ_ARTEFACTOS).map(([kind, valida]) => (
                  <tr key={kind} className="border-t border-[rgba(232,227,216,0.08)]">
                    <td className="px-2 py-1.5 text-[#e8e3d8]">{ARTIFACT_KIND_LABEL[kind as ArtifactKind]}</td>
                    {INSIGHTS_DE_ARTEFACTO.map((i) => (
                      <td key={i} className="px-1.5 py-1.5 text-center text-accent">
                        {valida.includes(i) ? "✓" : ""}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <p className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-[#5e7370]">
              Para cada artefacto · al menos {ITERACIONES_ARTEFACTO.minimo} vueltas
            </p>
            <ol className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[12px] text-[#cbd4d2]">
              {ITERACIONES_ARTEFACTO.ciclo.map((paso, i) => (
                <li key={paso} className="flex items-center gap-1.5">
                  <span className="rounded-[3px] border border-[rgba(111,191,178,0.35)] px-2 py-0.5">
                    {i + 1}. {paso}
                  </span>
                  {i < ITERACIONES_ARTEFACTO.ciclo.length - 1 && <span className="text-[#5e7370]">→</span>}
                </li>
              ))}
            </ol>
            <p className="mt-1.5 text-[11.5px] text-[#8b9a97]">
              Resultados: {ITERACIONES_ARTEFACTO.resultados.join(" · ")}.
            </p>
          </div>
        </div>
      )}

      {pestaña === "brochure" && (
        <div className="flex flex-col gap-4">
          <p className="max-w-[72ch] text-[12.5px] leading-relaxed text-[#a9b5b3]">
            El brochure cabe en {BROCHURE.paginas} páginas; el protocepto —la versión extendida—
            en {BROCHURE.hojasProtocepto} hojas como máximo. Los dos llevan las mismas cinco secciones.
          </p>
          <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {BROCHURE.secciones.map((s, i) => (
              <li key={s.key} className="rounded-[4px] border border-[rgba(232,227,216,0.12)] p-2.5">
                <p className="text-[12.5px] font-semibold text-[#e8e3d8]">
                  {i + 1}. {s.titulo}
                </p>
                <p className="mt-1 text-[11.5px] leading-snug text-[#a9b5b3]">{s.pregunta}</p>
              </li>
            ))}
          </ol>
          <div>
            <p className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-[#5e7370]">
              Brochure conceptual · preguntas por dimensión
            </p>
            <div className="mt-1.5 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              {Object.entries(BROCHURE.porDimension).map(([dim, preguntas]) => (
                <div key={dim} className="rounded-[4px] border border-[rgba(232,227,216,0.1)] p-2">
                  <p className="font-mono text-[9.5px] uppercase tracking-wider text-accent">{dim}</p>
                  <ul className="mt-1 flex flex-col gap-0.5 text-[11px] leading-snug text-[#a9b5b3]">
                    {preguntas.map((q) => (
                      <li key={q}>{q}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
          <ul className="flex flex-col gap-1">
            {BROCHURE.reglas.map((r) => (
              <li key={r} className="flex gap-2 text-[12px] leading-snug text-[#a9b5b3]">
                <span className="text-accent">·</span>
                {r}
              </li>
            ))}
          </ul>
        </div>
      )}

      {pestaña === "ia" && (
        <div className="flex flex-col gap-3">
          <p className="max-w-[72ch] text-[12.5px] leading-relaxed text-[#a9b5b3]">
            Alista tres imágenes: la foto de la descripción del concepto (el lienzo del Ejercicio
            1.1), el logo de la empresa sponsor y un pantallazo de su sitio web. Copia el prompt,
            adjunta las imágenes y revisa siempre el resultado antes de enviarle los ajustes a la IA.
          </p>
          {conceptos.length === 0 ? (
            <p className="text-[12px] text-[#8b9a97]">Primero hay que construir conceptos en Convergir.</p>
          ) : (
            <>
              <select
                className="field max-w-[48ch] text-[13px]"
                value={conceptId}
                onChange={(e) => setConceptId(e.target.value)}
              >
                {conceptos.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
              {datos && (
                <div className="grid gap-3 lg:grid-cols-2">
                  {[
                    { clave: "brochure", titulo: "Prompt del brochure", texto: promptBrochure(datos) },
                    { clave: "mockup", titulo: "Prompt del mockup", texto: promptMockup(datos) },
                  ].map((p) => (
                    <div key={p.clave} className="flex flex-col gap-2 rounded-[4px] border border-[rgba(232,227,216,0.12)] p-2.5">
                      <div className="flex items-center gap-2">
                        <p className="text-[12.5px] font-semibold text-[#e8e3d8]">{p.titulo}</p>
                        <span className="flex-1" />
                        <button type="button" className="btn" onClick={() => copiar(p.clave, p.texto)}>
                          {copiado === p.clave ? "Copiado" : "Copiar"}
                        </button>
                      </div>
                      <pre className="max-h-[260px] overflow-auto whitespace-pre-wrap text-[11.5px] leading-relaxed text-[#a9b5b3]">
                        {p.texto}
                      </pre>
                    </div>
                  ))}
                </div>
              )}
              {concepto && !concepto.frase && (
                <p className="text-[11.5px] text-[#c9a94e]">
                  Este concepto todavía no tiene la frase del Ejercicio 1.1: el prompt sale más pobre.
                  Complétala en Convergir.
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
