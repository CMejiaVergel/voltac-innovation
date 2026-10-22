import { Fragment } from "react";
import Link from "next/link";

import { IDEX, LINEA_CONCEPTO } from "@/lib/gimi";

export type EtapaEmbudo = {
  key: string;
  /** Cifra que resume la etapa (ej. «202 fragmentos»). */
  cifra?: string;
  estado: "HECHA" | "ACTUAL" | "PENDIENTE";
  href?: string;
};

export type ConceptoEnLinea = {
  nombre: string;
  /** Qué pasos de la línea ya completó, en orden. */
  pasos: boolean[];
  href?: string;
};

const EMBUDO = IDEX.filter((s) => s.key !== "actuar");

/**
 * El proceso como lo dibujó el mentor (15-oct-2026): un embudo que va de muchas
 * ideas a unos pocos conceptos priorizados y, desde ahí, una línea recta por
 * concepto con los mismos pasos. En pantalla ancha corre de izquierda a
 * derecha; en el celular, de arriba abajo.
 */
export function Embudo({
  etapas,
  conceptos,
  actuarHref,
}: {
  etapas: EtapaEmbudo[];
  conceptos: ConceptoEnLinea[];
  /** Enlace a Actuar cuando ya hay conceptos priorizados. */
  actuarHref?: string;
}) {
  const lineas: (ConceptoEnLinea & { fantasma?: boolean })[] = conceptos.length
    ? conceptos
    : [1, 2, 3].map((n) => ({ nombre: `Concepto ${n}`, pasos: [], fantasma: true }));

  return (
    <div className="panel">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch lg:gap-0">
        {/* El embudo */}
        <ol className="flex flex-col items-center gap-1.5 lg:flex-[3] lg:flex-row lg:items-center lg:gap-0">
          {EMBUDO.map((s, i) => {
            const e = etapas.find((x) => x.key === s.key) ?? { key: s.key, estado: "PENDIENTE" as const };
            const actual = e.estado === "ACTUAL";
            const hecha = e.estado === "HECHA";
            const ancho = 100 - i * 12;
            const alto = 168 - i * 26;
            const caja = (
              <div
                className="embudo-etapa relative flex flex-col justify-center px-4 py-3 transition lg:py-0"
                style={
                  {
                    "--ancho": `${ancho}%`,
                    "--alto": `${alto}px`,
                    background: actual ? "rgba(232,198,106,0.14)" : hecha ? "rgba(111,191,178,0.14)" : "rgba(232,227,216,0.04)",
                    borderColor: actual ? "#E8C66A" : hecha ? "#6FBFB2" : "rgba(232,227,216,0.12)",
                  } as React.CSSProperties
                }
              >
                <span className="flex items-center gap-2">
                  <span
                    className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-semibold ${
                      hecha ? "bg-accent text-accentDeep" : actual ? "border-2 border-[#E8C66A] text-[#E8C66A]" : "border border-[#4d5a58] text-[#7f8f8c]"
                    }`}
                  >
                    {hecha ? "✓" : s.n}
                  </span>
                  <span className={`text-[15px] font-semibold ${e.estado === "PENDIENTE" ? "text-[#7f8f8c]" : "text-[#e8e3d8]"}`}>
                    {s.name}
                  </span>
                  {actual && (
                    <span className="rounded-full bg-[#E8C66A] px-2 py-px text-[10px] font-semibold text-[#1b1f1f]">Ahora</span>
                  )}
                </span>
                <span className="mt-1 text-[11.5px] text-[#8b9a97]">{e.cifra ?? s.purpose}</span>
              </div>
            );
            return (
              <li key={s.key} className="flex w-full justify-center lg:w-auto lg:flex-1">
                {e.href ? (
                  <Link href={e.href} className="contents hover:brightness-125">
                    {caja}
                  </Link>
                ) : (
                  caja
                )}
              </li>
            );
          })}
        </ol>

        {/* Una línea recta por concepto priorizado */}
        <div className="flex flex-col justify-center gap-2 border-t border-dashed border-[rgba(232,227,216,0.14)] pt-4 lg:ml-3 lg:flex-[2] lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0">
          {actuarHref ? (
            <Link href={actuarHref} className="text-[13px] font-semibold text-[#e8e3d8] hover:text-accent">
              5 · Actuar <span className="font-normal text-[#7f8f8c]">· cada concepto, la misma línea →</span>
            </Link>
          ) : (
            <span className="text-[13px] font-semibold text-[#7f8f8c]">
              5 · Actuar <span className="font-normal">· cada concepto, la misma línea</span>
            </span>
          )}
          <div className="grid grid-cols-[66px_repeat(5,minmax(0,1fr))] items-center gap-x-0.5 gap-y-2.5 md:grid-cols-[130px_repeat(5,minmax(0,1fr))]">
            <span />
            {LINEA_CONCEPTO.map((p) => (
              <span key={p.key} className="text-center text-[9px] leading-tight md:text-[10px] text-[#7f8f8c]">
                {p.nombre}
              </span>
            ))}
            {lineas.map((c, k) => (
              <Fragment key={k}>
                <span className={`truncate text-[12px] text-[#c0ccca] ${c.fantasma ? "opacity-40" : ""}`}>
                  {c.href ? (
                    <Link href={c.href} className="hover:text-accent">
                      {c.nombre}
                    </Link>
                  ) : (
                    c.nombre
                  )}
                </span>
                {LINEA_CONCEPTO.map((p, j) => (
                  <span key={p.key} className={`relative flex justify-center ${c.fantasma ? "opacity-40" : ""}`} title={p.nombre}>
                    {j > 0 && <span className={`absolute left-0 right-1/2 top-1/2 h-px ${c.pasos[j - 1] && c.pasos[j] ? "bg-accent" : "bg-[#3a4745]"}`} />}
                    {j < LINEA_CONCEPTO.length - 1 && (
                      <span className={`absolute left-1/2 right-0 top-1/2 h-px ${c.pasos[j] && c.pasos[j + 1] ? "bg-accent" : "bg-[#3a4745]"}`} />
                    )}
                    <span className={`relative h-3 w-3 rounded-full ${c.pasos[j] ? "bg-accent" : "border border-[#4d5a58] bg-panel"}`} />
                  </span>
                ))}
              </Fragment>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
