"use client";

import { useMemo, useState } from "react";

import type { TemplateShape } from "@/lib/templates";
import { DOT_ROLE_META } from "@/lib/enums";
import type { InsightVista, Punto } from "./types";

/**
 * El mapa de puntos de la etapa Combinar.
 *
 * Las columnas son las cinco DIMENSIONES del negocio, no los lentes. Es una
 * rotacion deliberada del BOM: en Divergir se mira cada dimension desde cinco
 * angulos, y en Combinar se cruza de una dimension a otra. El libro de GIMI
 * llama a esas dimensiones las piezas del rompecabezas —mercado, canal,
 * oferta, capacidades, aliados— y pide una frase que las combine.
 *
 * COORDENADAS. Todo se dibuja en un espacio virtual de 1000 unidades de ancho
 * con `viewBox`, en vez de medir el DOM. Medir obligaria a un ResizeObserver y
 * a un primer fotograma con las lineas en el sitio equivocado; asi la posicion
 * de cada punto es la misma cuenta en el servidor y en el cliente, y el trazo
 * nunca aparece descolocado.
 *
 * Conectar dos puntos de la MISMA columna es valido: hay insights que salen de
 * cruzar dos hechos de la misma dimension. Por eso el trazo se dibuja con un
 * desvio lateral cuando origen y destino comparten columna, o seria una linea
 * recta invisible sobre si misma.
 */

const ANCHO = 1000;
const MARGEN_SUP = 54;
const MARGEN_INF = 26;
const SEPARACION = 26;
const RADIO = 6.5;

type Colocado = Punto & { x: number; y: number; color: string };

export function DotMap({
  shape,
  puntos,
  insights,
  seleccion,
  onToggle,
  resaltado,
}: {
  shape: TemplateShape;
  puntos: Punto[];
  insights: InsightVista[];
  /** Ids de fragmento seleccionados, en orden de seleccion. */
  seleccion: string[];
  onToggle: ((fragmentId: string) => void) | null;
  /** Insight cuyo trazo se muestra. null = ninguno; "todos" = todos. */
  resaltado: string | null | "todos";
}) {
  const [encima, setEncima] = useState<string | null>(null);

  const { colocados, porId, alto } = useMemo(() => {
    const columnas = shape.rows; // las filas del BOM son las columnas de aqui
    const anchoCol = ANCHO / columnas.length;
    const colocados: Colocado[] = [];
    let maximo = 0;

    columnas.forEach((col, i) => {
      const suyos = puntos.filter((p) => p.rowId === col.id);
      maximo = Math.max(maximo, suyos.length);
      suyos.forEach((p, j) => {
        colocados.push({
          ...p,
          x: anchoCol * i + anchoCol / 2,
          y: MARGEN_SUP + j * SEPARACION,
          color: col.color,
        });
      });
    });

    return {
      colocados,
      porId: new Map(colocados.map((c) => [c.id, c])),
      alto: MARGEN_SUP + Math.max(maximo - 1, 0) * SEPARACION + MARGEN_INF,
    };
  }, [shape.rows, puntos]);

  const anchoCol = ANCHO / shape.rows.length;

  /** Trazos a dibujar: los de los insights visibles y el de la seleccion viva. */
  const trazos = useMemo(() => {
    const lista: { id: string; puntos: Colocado[]; color: string; vivo: boolean }[] = [];

    if (resaltado === "todos" || resaltado) {
      for (const ins of insights) {
        if (resaltado !== "todos" && ins.id !== resaltado) continue;
        const ordenados = [...ins.dots].sort((a, b) => a.position - b.position);
        const coords = ordenados
          .map((d) => (d.fragmentId ? porId.get(d.fragmentId) : undefined))
          .filter((c): c is Colocado => Boolean(c));
        if (coords.length >= 2) {
          lista.push({ id: ins.id, puntos: coords, color: "#E0567F", vivo: false });
        }
      }
    }

    const enVivo = seleccion
      .map((id) => porId.get(id))
      .filter((c): c is Colocado => Boolean(c));
    if (enVivo.length >= 2) {
      lista.push({ id: "__seleccion", puntos: enVivo, color: "#6FBFB2", vivo: true });
    }

    return lista;
  }, [insights, porId, resaltado, seleccion]);

  const enSeleccion = new Set(seleccion);
  const enTrazo = new Set(trazos.flatMap((t) => t.puntos.map((p) => p.id)));
  const activo = encima ? porId.get(encima) : null;

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[680px]">
        {/* Cabecera: una franja por dimension, con su color de la plantilla */}
        <div
          className="grid gap-[2px] overflow-hidden rounded-t-[5px]"
          style={{ gridTemplateColumns: `repeat(${shape.rows.length}, minmax(0, 1fr))` }}
        >
          {shape.rows.map((r) => {
            const n = puntos.filter((p) => p.rowId === r.id).length;
            return (
              <div
                key={r.id}
                className="px-2 py-2 text-center text-white"
                style={{ background: r.color }}
                title={r.facets}
              >
                <div className="text-[11px] font-bold uppercase leading-tight tracking-[0.07em]">
                  {r.name}
                </div>
                <div className="mt-0.5 font-mono text-[9.5px] text-white/70">{n}</div>
              </div>
            );
          })}
        </div>

        {/* Lienzo */}
        <div className="relative rounded-b-[5px] border border-t-0 border-[rgba(232,227,216,0.13)] bg-[rgba(18,24,27,0.6)]">
          {/* Sin altura fija: el viewBox manda la proporcion y el SVG escala
              con el ancho. Con una altura en pixeles, preserveAspectRatio
              dibuja el contenido centrado a escala 1:1 y deja franjas muertas
              a los lados — los puntos dejan de coincidir con la columna que
              los encabeza, que es justo lo que este mapa tiene que garantizar. */}
          <svg
            viewBox={`0 0 ${ANCHO} ${alto}`}
            className="block w-full"
            role="img"
            aria-label="Mapa de puntos: fragmentos del mapa agrupados por dimension"
          >
            {/* Guias verticales, una por dimension */}
            {shape.rows.map((r, i) => (
              <line
                key={r.id}
                x1={anchoCol * i + anchoCol / 2}
                x2={anchoCol * i + anchoCol / 2}
                y1={MARGEN_SUP - 22}
                y2={alto - 8}
                stroke="rgba(232,227,216,0.09)"
                strokeDasharray="3 5"
              />
            ))}

            {/* Trazos. Van debajo de los puntos para no taparlos. */}
            {trazos.map((t) => (
              <g key={t.id}>
                <path
                  d={rutaDe(t.puntos, anchoCol)}
                  fill="none"
                  stroke={t.color}
                  strokeWidth={t.vivo ? 2.6 : 2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray={t.vivo ? "7 5" : undefined}
                  opacity={t.vivo ? 0.95 : 0.75}
                />
              </g>
            ))}

            {/* Puntos */}
            {colocados.map((p) => {
              const marcado = enSeleccion.has(p.id);
              const trazado = enTrazo.has(p.id);
              const orden = seleccion.indexOf(p.id);
              return (
                <g
                  key={p.id}
                  onMouseEnter={() => setEncima(p.id)}
                  onMouseLeave={() => setEncima((v) => (v === p.id ? null : v))}
                  onClick={() => onToggle?.(p.id)}
                  className={onToggle ? "cursor-pointer" : "cursor-default"}
                >
                  {/* Zona de contacto generosa: los puntos son pequeños */}
                  <circle cx={p.x} cy={p.y} r={13} fill="transparent" />
                  {(marcado || trazado) && (
                    <circle cx={p.x} cy={p.y} r={RADIO + 5} fill={p.color} opacity={0.22} />
                  )}
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={marcado ? RADIO + 1.5 : RADIO}
                    fill={p.color}
                    opacity={marcado || trazado || !seleccion.length ? 1 : 0.42}
                    stroke={marcado ? "#EDF2F0" : "transparent"}
                    strokeWidth={1.6}
                  />
                  {marcado && orden >= 0 && (
                    <text
                      x={p.x}
                      y={p.y + 3.4}
                      textAnchor="middle"
                      className="pointer-events-none select-none"
                      style={{ fontSize: 9, fontWeight: 700, fill: "#12181B" }}
                    >
                      {orden + 1}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>

          {/* Ficha del punto bajo el cursor. Se posiciona con los mismos
              numeros que el SVG, en porcentaje, asi no hay que medir nada. */}
          {activo && (
            <div
              className="pointer-events-none absolute z-10 w-[248px] rounded-[5px] border border-[rgba(232,227,216,0.2)] bg-[#1b2225] p-3 shadow-xl"
              style={{
                left: `${(activo.x / ANCHO) * 100}%`,
                top: `${(activo.y / alto) * 100}%`,
                transform: `translate(${activo.x > ANCHO * 0.66 ? "-108%" : "8%"}, -50%)`,
              }}
            >
              <p className="text-[12px] leading-snug text-[#e8e3d8]">{activo.text}</p>
              <p className="mt-2 flex items-center gap-2 border-t border-[rgba(232,227,216,0.12)] pt-2 font-mono text-[9.5px] uppercase tracking-[0.07em] text-[#8b9a97]">
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ background: activo.color }}
                />
                {nombreFila(shape, activo.rowId)} · {nombreCol(shape, activo.colId)}
              </p>
            </div>
          )}
        </div>

        {/* Leyenda de los papeles de un punto */}
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 font-mono text-[10px] text-[#5e7370]">
          {Object.entries(DOT_ROLE_META).map(([k, m]) => (
            <span key={k} className="inline-flex items-center gap-1.5" title={m.help}>
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: m.color }}
              />
              {m.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Traza el recorrido entre puntos.
 *
 * Dos puntos de la misma columna quedarian unidos por una recta vertical que
 * se confunde con la guia de la columna, asi que ese tramo se dibuja como una
 * curva que se abre hacia un lado. Sigue siendo el mismo recorrido, pero se ve.
 */
function rutaDe(puntos: { x: number; y: number }[], anchoCol: number): string {
  if (puntos.length === 0) return "";
  let d = `M ${puntos[0].x} ${puntos[0].y}`;
  for (let i = 1; i < puntos.length; i++) {
    const a = puntos[i - 1];
    const b = puntos[i];
    if (a.x === b.x) {
      const desvio = anchoCol * 0.28;
      const medio = (a.y + b.y) / 2;
      d += ` Q ${a.x + desvio} ${medio} ${b.x} ${b.y}`;
    } else {
      d += ` L ${b.x} ${b.y}`;
    }
  }
  return d;
}

function nombreFila(shape: TemplateShape, id: string) {
  return shape.rows.find((r) => r.id === id)?.name ?? id;
}
function nombreCol(shape: TemplateShape, id: string) {
  return shape.cols.find((c) => c.id === id)?.name ?? id;
}
