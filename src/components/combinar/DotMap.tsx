"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import type { TemplateShape } from "@/lib/templates";
import { DOT_ROLE_META, colorDeTrazo } from "@/lib/enums";
import type { InsightVista, Punto } from "./types";

/**
 * El mapa de puntos de la etapa Combinar.
 *
 * Las columnas son las cinco DIMENSIONES del negocio, no los lentes. Es una
 * rotacion deliberada del BOM: en Divergir se mira cada dimension desde cinco
 * angulos, y en Combinar se cruza de una dimension a otra. El libro de GIMI
 * llama a esas dimensiones las piezas del rompecabezas.
 *
 * POR QUE SE MIDE EL DOM. Las posiciones de los puntos se calculaban antes con
 * aritmetica pura, para evitar el fotograma en el que las lineas aparecen
 * descolocadas. Con los textos visibles eso ya no vale: cada punto ocupa un
 * alto distinto segun cuanto texto tenga, y ninguna formula lo sabe. Se miden
 * los puntos y se dibujan encima. El fotograma de espera no se nota porque los
 * trazos entran animados de todas formas.
 */

type Medida = { x: number; y: number };

export function DotMap({
  shape,
  puntos,
  insights,
  seleccion,
  onToggle,
  resaltado,
  mostrarTextos,
}: {
  shape: TemplateShape;
  puntos: Punto[];
  insights: InsightVista[];
  /** Ids de fragmento seleccionados, en orden de seleccion. */
  seleccion: string[];
  onToggle: ((fragmentId: string) => void) | null;
  /** Insight cuyo trazo se muestra. null = ninguno; "todos" = todos. */
  resaltado: string | null | "todos";
  mostrarTextos: boolean;
}) {
  const contenedor = useRef<HTMLDivElement>(null);
  const nodos = useRef(new Map<string, HTMLElement>());
  const [medidas, setMedidas] = useState<Map<string, Medida>>(new Map());
  const [caja, setCaja] = useState({ w: 0, h: 0 });
  const [encima, setEncima] = useState<string | null>(null);

  const registrar = useCallback((id: string, el: HTMLElement | null) => {
    if (el) nodos.current.set(id, el);
    else nodos.current.delete(id);
  }, []);

  const medir = useCallback(() => {
    const cont = contenedor.current;
    if (!cont) return;
    const base = cont.getBoundingClientRect();
    const m = new Map<string, Medida>();
    for (const [id, el] of nodos.current) {
      const r = el.getBoundingClientRect();
      m.set(id, { x: r.x - base.x + r.width / 2, y: r.y - base.y + r.height / 2 });
    }
    setMedidas(m);
    setCaja({ w: base.width, h: base.height });
  }, []);

  // useLayoutEffect y no useEffect: se mide antes de pintar, para que el trazo
  // no llegue nunca a verse en la posicion equivocada.
  useLayoutEffect(() => {
    medir();
  }, [medir, mostrarTextos, puntos, insights]);

  useEffect(() => {
    const cont = contenedor.current;
    if (!cont || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => medir());
    ro.observe(cont);
    window.addEventListener("resize", medir);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", medir);
    };
  }, [medir]);

  const visibles = insights.filter(
    (i) => resaltado === "todos" || (resaltado !== null && i.id === resaltado),
  );

  const trazos = visibles
    .map((ins) => {
      const coords = [...ins.dots]
        .sort((a, b) => a.position - b.position)
        .map((d) => (d.fragmentId ? medidas.get(d.fragmentId) : undefined))
        .filter((c): c is Medida => Boolean(c));
      return {
        id: ins.id,
        color: colorDeTrazo(ins.color, ins.position),
        coords,
        ids: [...ins.dots].sort((a, b) => a.position - b.position).map((d) => d.fragmentId),
      };
    })
    .filter((t) => t.coords.length >= 2);

  const enVivo = seleccion.map((id) => medidas.get(id)).filter((c): c is Medida => Boolean(c));

  // Que punto pertenece a algun trazo visible, y de que color se ilumina.
  const iluminados = new Map<string, string>();
  for (const t of trazos) {
    for (const id of t.ids) if (id) iluminados.set(id, t.color);
  }

  const enSeleccion = new Set(seleccion);
  const hayFoco = seleccion.length > 0 || (resaltado !== "todos" && resaltado !== null);
  const activo = encima ? puntos.find((p) => p.id === encima) : null;
  const medidaActiva = encima ? medidas.get(encima) : null;

  return (
    <div className="overflow-x-auto">
      <style>{`
        @keyframes trazo-dibuja { from { stroke-dashoffset: 1; } to { stroke-dashoffset: 0; } }
        @keyframes punto-enciende {
          0%   { opacity: 0; transform: scale(0.2); }
          60%  { opacity: 1; transform: scale(1.5); }
          100% { opacity: 1; transform: scale(1); }
        }
        .trazo-anim { animation: trazo-dibuja 1.1s cubic-bezier(.4,0,.2,1) both; }
        .halo-anim  { animation: punto-enciende .5s cubic-bezier(.34,1.4,.64,1) both; }
        @media (prefers-reduced-motion: reduce) {
          .trazo-anim, .halo-anim { animation: none; }
        }
      `}</style>

      <div className={mostrarTextos ? "min-w-[900px]" : "min-w-[620px]"}>
        {/* Cabecera: una franja por dimension, con su color de la plantilla */}
        <div className="grid gap-[2px] overflow-hidden rounded-t-[5px]" style={cols(shape)}>
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

        {/* Lienzo: los puntos son HTML y los trazos un SVG encima */}
        <div
          ref={contenedor}
          className="relative rounded-b-[5px] border border-t-0 border-[rgba(232,227,216,0.13)] bg-[rgba(18,24,27,0.6)] p-3"
        >
          <div className="grid gap-[2px]" style={cols(shape)}>
            {shape.rows.map((col) => (
              <div key={col.id} className="flex flex-col gap-1">
                {puntos
                  .filter((p) => p.rowId === col.id)
                  .map((p) => {
                    const marcado = enSeleccion.has(p.id);
                    const iluminado = iluminados.get(p.id);
                    const orden = seleccion.indexOf(p.id);
                    const apagado = hayFoco && !marcado && !iluminado;
                    return (
                      <div
                        key={p.id}
                        onMouseEnter={() => setEncima(p.id)}
                        onMouseLeave={() => setEncima((v) => (v === p.id ? null : v))}
                        onClick={() => onToggle?.(p.id)}
                        className={`group flex items-start gap-1.5 rounded-[3px] px-1 py-[3px] transition ${
                          onToggle ? "cursor-pointer hover:bg-[rgba(232,227,216,0.07)]" : ""
                        } ${apagado ? "opacity-35" : ""}`}
                      >
                        <span
                          ref={(el) => registrar(p.id, el)}
                          className="relative mt-[3px] grid h-[13px] w-[13px] flex-none place-items-center"
                        >
                          {(marcado || iluminado) && (
                            <span
                              key={`${iluminado ?? "sel"}-${resaltado}`}
                              className="halo-anim absolute inset-[-4px] rounded-full"
                              style={{
                                background: iluminado ?? "#6FBFB2",
                                opacity: 0.28,
                                animationDelay: `${(orden >= 0 ? orden : 0) * 0.12}s`,
                              }}
                            />
                          )}
                          <span
                            className="relative block rounded-full transition-all"
                            style={{
                              width: marcado ? 12 : 10,
                              height: marcado ? 12 : 10,
                              background: col.color,
                              boxShadow: marcado
                                ? "0 0 0 1.5px #EDF2F0"
                                : iluminado
                                  ? `0 0 0 1.5px ${iluminado}`
                                  : undefined,
                            }}
                          />
                          {marcado && orden >= 0 && (
                            <span className="pointer-events-none absolute inset-0 grid place-items-center font-mono text-[8px] font-bold leading-none text-[#12181B]">
                              {orden + 1}
                            </span>
                          )}
                        </span>

                        {mostrarTextos && (
                          <span className="min-w-0 flex-1 text-[10.5px] leading-[1.35] text-[#a9b5b3] transition group-hover:text-[#e8e3d8]">
                            {p.text}
                          </span>
                        )}
                      </div>
                    );
                  })}
              </div>
            ))}
          </div>

          {/* Trazos. pointer-events-none: no deben robar el clic a los puntos. */}
          {caja.w > 0 && (
            <svg
              className="pointer-events-none absolute inset-0"
              width={caja.w}
              height={caja.h}
              viewBox={`0 0 ${caja.w} ${caja.h}`}
              aria-hidden
            >
              {trazos.map((t) => (
                <path
                  key={`${t.id}-${resaltado}-${mostrarTextos}`}
                  d={ruta(t.coords)}
                  fill="none"
                  stroke={t.color}
                  strokeWidth={2.2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={0.85}
                  pathLength={1}
                  strokeDasharray={1}
                  className="trazo-anim"
                />
              ))}
              {enVivo.length >= 2 && (
                <path
                  d={ruta(enVivo)}
                  fill="none"
                  stroke="#6FBFB2"
                  strokeWidth={2.6}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray="7 5"
                  opacity={0.95}
                />
              )}
            </svg>
          )}

          {/* Ficha del punto bajo el cursor */}
          {activo && medidaActiva && (
            <div
              className="pointer-events-none absolute z-10 w-[250px] rounded-[5px] border border-[rgba(232,227,216,0.2)] bg-[#1b2225] p-3 shadow-xl"
              style={{
                left: medidaActiva.x,
                top: medidaActiva.y,
                transform: `translate(${medidaActiva.x > caja.w * 0.6 ? "-106%" : "14px"}, -50%)`,
              }}
            >
              <p className="text-[12px] leading-snug text-[#e8e3d8]">{activo.text}</p>
              <p className="mt-2 flex items-center gap-2 border-t border-[rgba(232,227,216,0.12)] pt-2 font-mono text-[9.5px] uppercase tracking-[0.07em] text-[#8b9a97]">
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ background: shape.rows.find((r) => r.id === activo.rowId)?.color }}
                />
                {nombre(shape.rows, activo.rowId)} · {nombre(shape.cols, activo.colId)}
              </p>
            </div>
          )}
        </div>

        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 font-mono text-[10px] text-[#5e7370]">
          {Object.entries(DOT_ROLE_META).map(([k, m]) => (
            <span key={k} className="inline-flex items-center gap-1.5" title={m.help}>
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: m.color }} />
              {m.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function cols(shape: TemplateShape) {
  return { gridTemplateColumns: `repeat(${shape.rows.length}, minmax(0, 1fr))` };
}

function nombre(lista: { id: string; name: string }[], id: string) {
  return lista.find((x) => x.id === id)?.name ?? id;
}

/**
 * Traza el recorrido entre puntos.
 *
 * Dos puntos de la misma columna quedarian unidos por una recta vertical que se
 * confunde con la propia columna, asi que ese tramo se abre en curva hacia un
 * lado. Sigue siendo el mismo recorrido, pero se ve.
 */
function ruta(puntos: Medida[]): string {
  if (puntos.length === 0) return "";
  let d = `M ${puntos[0].x} ${puntos[0].y}`;
  for (let i = 1; i < puntos.length; i++) {
    const a = puntos[i - 1];
    const b = puntos[i];
    if (Math.abs(a.x - b.x) < 2) {
      const desvio = Math.max(26, Math.abs(b.y - a.y) * 0.22);
      d += ` Q ${a.x + desvio} ${(a.y + b.y) / 2} ${b.x} ${b.y}`;
    } else {
      d += ` L ${b.x} ${b.y}`;
    }
  }
  return d;
}
