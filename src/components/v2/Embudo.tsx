import Link from "next/link";

import { HATS, IDEX } from "@/lib/gimi";

export type EtapaEmbudo = {
  key: string;
  /** Cifra que resume la etapa (ej. «202 fragmentos»). */
  cifra?: string;
  estado: "HECHA" | "ACTUAL" | "PENDIENTE" | "REDISENO";
  href?: string;
};

const ESTADO_META: Record<EtapaEmbudo["estado"], { label: string; color: string }> = {
  HECHA: { label: "Hecha", color: "#6FBFB2" },
  ACTUAL: { label: "En curso", color: "#E8C66A" },
  PENDIENTE: { label: "Pendiente", color: "#7f8f8c" },
  REDISENO: { label: "En rediseño", color: "#5e7370" },
};

/**
 * El proceso como un embudo (recomendación del mentor, 15-oct-2026): muchas
 * ideas a la izquierda, un solo concepto que sigue «en línea recta» a la
 * derecha. Cada etapa se estrecha y la gente ve siempre dónde está.
 */
export function Embudo({ etapas }: { etapas: EtapaEmbudo[] }) {
  return (
    <div className="panel overflow-x-auto">
      <h2 className="kicker mb-5">El proceso como un embudo</h2>
      <div className="flex min-w-[760px] items-center">
        {IDEX.map((s, i) => {
          const e = etapas.find((x) => x.key === s.key) ?? { key: s.key, estado: "PENDIENTE" as const };
          const meta = ESTADO_META[e.estado];
          const alto = 190 - i * 28;
          const contenido = (
            <div
              className="relative flex flex-col justify-center px-4 transition"
              style={{
                height: alto,
                background: e.estado === "ACTUAL" ? "rgba(232,198,106,0.12)" : e.estado === "HECHA" ? "rgba(111,191,178,0.12)" : "rgba(232,227,216,0.04)",
                borderTop: `2px solid ${meta.color}`,
                borderBottom: `2px solid ${meta.color}`,
                clipPath: "polygon(0 0, calc(100% - 14px) 8%, 100% 50%, calc(100% - 14px) 92%, 0 100%)",
                opacity: e.estado === "REDISENO" ? 0.55 : 1,
              }}
            >
              <span className="font-mono text-[10px] uppercase tracking-[0.14em]" style={{ color: meta.color }}>
                {s.n} · {meta.label}
              </span>
              <span className="mt-1 text-[15px] font-semibold text-[#e8e3d8]">{s.name}</span>
              <span className="text-[11px] text-[#8b9a97]">{s.purpose}</span>
              {e.cifra && <span className="mt-1.5 font-mono text-[11px] text-[#c0ccca]">{e.cifra}</span>}
              <span className="mt-2 flex gap-1">
                {s.hats.map((h) => (
                  <span key={h} title={`Sombrero ${HATS[h].name}`} className="inline-block h-2 w-2 rounded-full" style={{ background: HATS[h].color }} />
                ))}
              </span>
            </div>
          );
          return (
            <div key={s.key} className="flex-1">
              {e.href && e.estado !== "REDISENO" ? (
                <Link href={e.href} className="block hover:brightness-125">
                  {contenido}
                </Link>
              ) : (
                contenido
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
