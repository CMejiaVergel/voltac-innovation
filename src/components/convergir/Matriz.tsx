"use client";

import { useState } from "react";

import { colorDeTrazo, promedioEje, puntuados, SUBCRITERIOS } from "@/lib/enums";
import type { ConceptoVista } from "./types";

/**
 * La matriz de priorizacion: Fit en horizontal, Impacto en vertical.
 *
 * Los ejes salen del promedio de sus tres subcriterios (CV.pdf p4). Un concepto
 * SIN PUNTUAR no aparece flotando en el centro —eso lo haria parecer mediocre
 * cuando en realidad nadie lo ha mirado— sino en una lista aparte debajo. La
 * matriz solo muestra lo que el equipo ya evaluo.
 *
 * Las coordenadas se calculan, no se miden: la rejilla es fija de 1 a 5 en los
 * dos ejes, asi que el SVG es determinista y no hace falta observar el DOM.
 */

const LADO = 460;
const MARGEN = 46;
const UTIL = LADO - MARGEN * 2;

/** De la escala 1..5 a coordenada. El eje Y se invierte: 5 arriba. */
const ejeX = (v: number) => MARGEN + ((v - 1) / 4) * UTIL;
const ejeY = (v: number) => MARGEN + UTIL - ((v - 1) / 4) * UTIL;

export function Matriz({
  conceptos,
  activo,
  onActivar,
}: {
  conceptos: ConceptoVista[];
  activo: string | null;
  onActivar: (id: string | null) => void;
}) {
  const [encima, setEncima] = useState<string | null>(null);

  const colocados = conceptos
    .map((c) => {
      const imp = promedioEje(c, "impacto");
      const fit = promedioEje(c, "fit");
      return imp !== null && fit !== null ? { c, imp, fit } : null;
    })
    .filter((x): x is { c: ConceptoVista; imp: number; fit: number } => x !== null);

  const sinPuntuar = conceptos.filter(
    (c) => promedioEje(c, "impacto") === null || promedioEje(c, "fit") === null,
  );

  const señalado = encima ?? activo;

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${LADO} ${LADO}`}
          className="block w-full max-w-[520px]"
          role="img"
          aria-label="Matriz de priorizacion: impacto contra fit"
        >
          {/* Cuadrantes. El de arriba a la derecha es el unico que dice
              "seguir": alto impacto y buen encaje con el reto. */}
          <rect
            x={ejeX(3)}
            y={MARGEN}
            width={UTIL / 2}
            height={UTIL / 2}
            fill="rgba(111,191,178,0.09)"
          />
          <text
            x={ejeX(5) - 6}
            y={MARGEN + 16}
            textAnchor="end"
            style={{ fontSize: 10, fill: "#6FBFB2", letterSpacing: "0.08em" }}
          >
            PERSEGUIR
          </text>
          <text
            x={MARGEN + 6}
            y={MARGEN + UTIL - 8}
            style={{ fontSize: 10, fill: "#5e7370", letterSpacing: "0.08em" }}
          >
            DESCARTAR
          </text>

          {/* Rejilla */}
          {[1, 2, 3, 4, 5].map((v) => (
            <g key={v}>
              <line
                x1={ejeX(v)}
                x2={ejeX(v)}
                y1={MARGEN}
                y2={MARGEN + UTIL}
                stroke="rgba(232,227,216,0.09)"
              />
              <line
                x1={MARGEN}
                x2={MARGEN + UTIL}
                y1={ejeY(v)}
                y2={ejeY(v)}
                stroke="rgba(232,227,216,0.09)"
              />
              <text
                x={ejeX(v)}
                y={MARGEN + UTIL + 16}
                textAnchor="middle"
                style={{ fontSize: 9, fill: "#5e7370" }}
              >
                {v}
              </text>
              <text
                x={MARGEN - 10}
                y={ejeY(v) + 3}
                textAnchor="end"
                style={{ fontSize: 9, fill: "#5e7370" }}
              >
                {v}
              </text>
            </g>
          ))}

          {/* Ejes */}
          <line
            x1={MARGEN}
            x2={MARGEN + UTIL}
            y1={MARGEN + UTIL}
            y2={MARGEN + UTIL}
            stroke="rgba(232,227,216,0.3)"
          />
          <line
            x1={MARGEN}
            x2={MARGEN}
            y1={MARGEN}
            y2={MARGEN + UTIL}
            stroke="rgba(232,227,216,0.3)"
          />
          <text
            x={MARGEN + UTIL / 2}
            y={LADO - 8}
            textAnchor="middle"
            style={{ fontSize: 11, fill: "#8b9a97", letterSpacing: "0.1em" }}
          >
            FIT
          </text>
          <text
            x={14}
            y={MARGEN + UTIL / 2}
            textAnchor="middle"
            transform={`rotate(-90 14 ${MARGEN + UTIL / 2})`}
            style={{ fontSize: 11, fill: "#8b9a97", letterSpacing: "0.1em" }}
          >
            IMPACTO
          </text>

          {/* Conceptos */}
          {colocados.map(({ c, imp, fit }, i) => {
            const color = colorDeTrazo(c.color, c.position);
            const señal = señalado === c.id;
            const n = puntuados(c);
            return (
              <g
                key={c.id}
                onMouseEnter={() => setEncima(c.id)}
                onMouseLeave={() => setEncima((v) => (v === c.id ? null : v))}
                onClick={() => onActivar(activo === c.id ? null : c.id)}
                className="cursor-pointer"
              >
                <circle cx={ejeX(fit)} cy={ejeY(imp)} r={16} fill="transparent" />
                {señal && (
                  <circle cx={ejeX(fit)} cy={ejeY(imp)} r={17} fill={color} opacity={0.2} />
                )}
                <circle
                  cx={ejeX(fit)}
                  cy={ejeY(imp)}
                  r={11}
                  fill={color}
                  opacity={señalado && !señal ? 0.35 : 1}
                  stroke={señal ? "#EDF2F0" : "transparent"}
                  strokeWidth={1.6}
                />
                <text
                  x={ejeX(fit)}
                  y={ejeY(imp) + 4}
                  textAnchor="middle"
                  className="pointer-events-none select-none"
                  style={{ fontSize: 11, fontWeight: 700, fill: "#12181B" }}
                >
                  {i + 1}
                </text>
                {/* Aviso de evaluacion incompleta: el punto esta colocado con
                    menos de los seis criterios y puede moverse. */}
                {n < SUBCRITERIOS.length && (
                  <circle
                    cx={ejeX(fit) + 9}
                    cy={ejeY(imp) - 9}
                    r={3.5}
                    fill="#C9A94E"
                    stroke="#12181B"
                    strokeWidth={1}
                  />
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Leyenda: el numero del punto con su nombre */}
      {colocados.length > 0 && (
        <ol className="flex flex-col gap-1">
          {colocados.map(({ c, imp, fit }, i) => (
            <li key={c.id}>
              <button
                type="button"
                onMouseEnter={() => setEncima(c.id)}
                onMouseLeave={() => setEncima((v) => (v === c.id ? null : v))}
                onClick={() => onActivar(activo === c.id ? null : c.id)}
                className={`flex w-full items-baseline gap-2 rounded-[3px] px-1.5 py-1 text-left transition ${
                  señalado === c.id ? "bg-[rgba(232,227,216,0.07)]" : ""
                }`}
              >
                <span
                  className="grid h-[15px] w-[15px] flex-none place-items-center rounded-full font-mono text-[9px] font-bold text-[#12181B]"
                  style={{ background: colorDeTrazo(c.color, c.position) }}
                >
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1 truncate text-[12.5px] text-[#cbd4d2]">
                  {c.title}
                </span>
                <span className="flex-none font-mono text-[10px] text-[#7d8a88] [font-variant-numeric:tabular-nums]">
                  imp {imp.toFixed(1)} · fit {fit.toFixed(1)}
                </span>
              </button>
            </li>
          ))}
        </ol>
      )}

      {/* Los que aun no se pueden colocar. Van aparte y no en el centro: un
          concepto sin evaluar no es un concepto mediocre. */}
      {sinPuntuar.length > 0 && (
        <p className="rounded-[4px] border border-dashed border-[rgba(201,162,39,0.4)] p-2.5 text-[11.5px] leading-snug text-[#c9a94e]">
          {sinPuntuar.length} concepto{sinPuntuar.length === 1 ? "" : "s"} sin puntuar
          {sinPuntuar.length === 1 ? " todavia" : " todavia"}:{" "}
          {sinPuntuar.map((c) => c.title).join(", ")}. No aparecen en la matriz hasta que
          tengan al menos un criterio de cada eje.
        </p>
      )}
    </div>
  );
}
