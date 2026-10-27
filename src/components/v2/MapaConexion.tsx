"use client";

import { useMemo, useState } from "react";

import type { TemplateShape } from "@/lib/templates";
import { PALETA_TRAZOS } from "@/lib/enums";
import { tituloPostit } from "@/lib/v2";
import type { ConceptoLienzo, PostitLienzo } from "./LienzoConcepto";

/**
 * El mapa de conexión de puntos: el BOM completo con cada post-it como un
 * punto, y el concepto como el trazo que lo atraviesa de una dimensión a la
 * otra. «Conectar los puntos» (IMBOK p. 61; Taller 3, lám. 13) a la vista:
 * el equipo ve qué dimensiones toca el concepto, cuáles le faltan, y lo itera
 * tocando los puntos (mentor, 15-oct-2026: «conectar, desconectar y
 * reconectar»).
 *
 * Las columnas son las dimensiones y las filas las lentes, para que el trazo
 * corra de izquierda a derecha por la cadena de valor, como en la v1.
 */

const W = 1000;
const IZQ = 112;
const ARRIBA = 46;
const ALTO_FILA = 112;
const ANCHO_COL = (W - IZQ) / 5;

export function MapaConexion({
  shape,
  postits,
  conceptos,
  activoId,
  editable,
  onAnclar,
  onSoltar,
}: {
  shape: TemplateShape;
  postits: PostitLienzo[];
  conceptos: ConceptoLienzo[];
  activoId: string;
  editable: boolean;
  onAnclar: (fragmentId: string, rowId: string) => void;
  onSoltar: (fragmentId: string) => void;
}) {
  const [verOtros, setVerOtros] = useState(false);
  const [encima, setEncima] = useState<string | null>(null);
  const dims = shape.rows;
  const lentes = shape.cols;
  const alto = ARRIBA + lentes.length * ALTO_FILA + 8;
  const colorDe = (id: string) => PALETA_TRAZOS[Math.max(0, conceptos.findIndex((c) => c.id === id)) % PALETA_TRAZOS.length];

  // Posición fija de cada post-it dentro de su celda: una cuadrícula pequeña.
  const posicion = useMemo(() => {
    const m = new Map<string, { x: number; y: number }>();
    const porCelda = new Map<string, PostitLienzo[]>();
    for (const p of postits) {
      const k = `${p.rowId}|${p.colId}`;
      porCelda.set(k, [...(porCelda.get(k) ?? []), p]);
    }
    for (const [k, lista] of porCelda) {
      const [rowId, colId] = k.split("|");
      const ci = dims.findIndex((r) => r.id === rowId);
      const fi = lentes.findIndex((c) => c.id === colId);
      if (ci < 0 || fi < 0) continue;
      const cols = Math.min(8, Math.max(3, Math.ceil(Math.sqrt(lista.length * 2))));
      const filas = Math.ceil(lista.length / cols);
      const pasoX = (ANCHO_COL - 28) / cols;
      const pasoY = Math.min(22, (ALTO_FILA - 24) / Math.max(1, filas));
      const x0 = IZQ + ci * ANCHO_COL + 14 + pasoX / 2;
      const y0 = ARRIBA + fi * ALTO_FILA + ALTO_FILA / 2 - ((filas - 1) * pasoY) / 2;
      lista.forEach((p, i) => m.set(p.id, { x: x0 + (i % cols) * pasoX, y: y0 + Math.floor(i / cols) * pasoY }));
    }
    return m;
  }, [postits, dims, lentes]);

  const porId = useMemo(() => new Map(postits.map((p) => [p.id, p])), [postits]);
  const activo = conceptos.find((c) => c.id === activoId);

  /** El recorrido de un concepto: sus puntos en el orden de la cadena de valor. */
  function recorrido(c: ConceptoLienzo) {
    return c.anclas
      .map((a) => (a.fragmentId ? porId.get(a.fragmentId) : undefined))
      .filter((p): p is PostitLienzo => !!p && posicion.has(p.id))
      .sort((a, b) => dims.findIndex((r) => r.id === a.rowId) - dims.findIndex((r) => r.id === b.rowId) || lentes.findIndex((l) => l.id === a.colId) - lentes.findIndex((l) => l.id === b.colId));
  }

  function trazo(puntos: PostitLienzo[]) {
    if (puntos.length < 2) return "";
    return puntos
      .map((p, i) => {
        const { x, y } = posicion.get(p.id)!;
        if (i === 0) return `M ${x} ${y}`;
        const prev = posicion.get(puntos[i - 1].id)!;
        const mx = (prev.x + x) / 2;
        return `C ${mx} ${prev.y}, ${mx} ${y}, ${x} ${y}`;
      })
      .join(" ");
  }

  if (!activo) return null;
  const propio = recorrido(activo);
  const enConcepto = new Set(propio.map((p) => p.id));
  const tocadas = new Set(propio.map((p) => p.rowId));
  const faltan = dims.filter((r) => !tocadas.has(r.id));
  const color = colorDe(activo.id);
  const otros = conceptos.filter((c) => c.id !== activo.id);
  const sobre = encima ? porId.get(encima) : undefined;

  return (
    <section className="panel mt-4">
      <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1">
        <h3 className="text-[14px] font-semibold text-[#e8e3d8]">Mapa de conexión de puntos</h3>
        <span className="text-[12px] text-[#8b9a97]">
          {propio.length} puntos · atraviesa {tocadas.size} de {dims.length} dimensiones
          {faltan.length > 0 && <span className="text-[#E8C66A]"> · falta {faltan.map((r) => r.name).join(", ")}</span>}
        </span>
        <span className="flex-1" />
        {otros.length > 0 && (
          <label className="flex items-center gap-1.5 text-[12px] text-[#a9b5b3]">
            <input type="checkbox" checked={verOtros} onChange={() => setVerOtros(!verOtros)} />
            Ver los demás conceptos
          </label>
        )}
      </div>
      {editable && <p className="mb-2 text-[11.5px] text-[#7f8f8c]">Toque un punto para sumarlo al concepto o para soltarlo.</p>}

      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${alto}`} className="block w-full min-w-[620px]" role="img" aria-label={`Recorrido de ${activo.title} por el mapa de oportunidades`}>
          {/* Encabezados: las dimensiones */}
          {dims.map((r, i) => (
            <g key={r.id}>
              <rect x={IZQ + i * ANCHO_COL + 3} y={ARRIBA} width={ANCHO_COL - 6} height={lentes.length * ALTO_FILA} rx={6} fill={r.color} opacity={tocadas.has(r.id) ? 0.13 : 0.05} />
              <rect x={IZQ + i * ANCHO_COL + 3} y={8} width={ANCHO_COL - 6} height={30} rx={4} fill={r.color} opacity={tocadas.has(r.id) ? 0.9 : 0.35} />
              <text x={IZQ + i * ANCHO_COL + ANCHO_COL / 2} y={28} textAnchor="middle" fontSize={14} fontWeight={600} fill="#12181b">
                {r.name}
              </text>
            </g>
          ))}
          {/* Las lentes */}
          {lentes.map((c, j) => (
            <g key={c.id}>
              {j > 0 && <line x1={IZQ} x2={W} y1={ARRIBA + j * ALTO_FILA} y2={ARRIBA + j * ALTO_FILA} stroke="rgba(232,227,216,0.08)" />}
              <text x={IZQ - 10} y={ARRIBA + j * ALTO_FILA + ALTO_FILA / 2 + 4} textAnchor="end" fontSize={12.5} fill="#8b9a97">
                {c.name}
              </text>
            </g>
          ))}

          {/* Los demás conceptos, tenues */}
          {verOtros &&
            otros.map((c) => (
              <path key={c.id} d={trazo(recorrido(c))} fill="none" stroke={colorDe(c.id)} strokeWidth={2} opacity={0.35} strokeDasharray="6 5" />
            ))}

          {/* El concepto activo */}
          <path key={propio.map((p) => p.id).join()} d={trazo(propio)} fill="none" stroke={color} strokeWidth={3.5} strokeLinecap="round" pathLength={1} className="trazo-concepto" />

          {/* Todos los post-its como puntos */}
          {postits.map((p) => {
            const pos = posicion.get(p.id);
            if (!pos) return null;
            const dentro = enConcepto.has(p.id);
            const deOtro = verOtros && !dentro && otros.some((c) => c.anclas.some((a) => a.fragmentId === p.id));
            return (
              <circle
                key={p.id}
                cx={pos.x}
                cy={pos.y}
                r={dentro ? 8 : encima === p.id ? 6.5 : 4.5}
                fill={dentro ? color : deOtro ? "#a9b5b3" : p.hotspot ? "#E8C66A" : "#4d5a58"}
                stroke={dentro ? "#12181b" : "none"}
                strokeWidth={2}
                style={{ cursor: editable ? "pointer" : "default", transition: "r 0.15s, fill 0.15s" }}
                onMouseEnter={() => setEncima(p.id)}
                onMouseLeave={() => setEncima((e) => (e === p.id ? null : e))}
                onClick={() => editable && (dentro ? onSoltar(p.id) : onAnclar(p.id, p.rowId))}
              >
                <title>{tituloPostit(p)}</title>
              </circle>
            );
          })}

          {/* Etiquetas: todas si caben; si el concepto tiene muchos puntos, solo la del que está bajo el cursor */}
          {propio.filter((p) => propio.length <= 12 || p.id === encima).map((p) => {
            const pos = posicion.get(p.id)!;
            return (
              <text key={`t-${p.id}`} x={pos.x} y={pos.y - 12} textAnchor="middle" fontSize={10.5} fill="#e8e3d8" style={{ pointerEvents: "none" }}>
                {corto(tituloPostit(p), 22)}
              </text>
            );
          })}
        </svg>
      </div>
      <p className="mt-1 h-4 text-[12px] text-[#c9d1cf]">{sobre ? `${tituloPostit(sobre)}${enConcepto.has(sobre.id) ? " · en el concepto" : ""}` : ""}</p>
    </section>
  );
}

function corto(t: string, n: number) {
  return t.length > n ? t.slice(0, n - 1) + "…" : t;
}
