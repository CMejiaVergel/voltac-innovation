"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { PASOS_CONFIGURAR } from "@/lib/gimi";

/** Los cuatro pasos de Configurar como una línea de avance, con el estado de cada uno. */
export function PasosConfigurar({ slug, hechos }: { slug: string; hechos: Record<string, boolean> }) {
  const pathname = usePathname();
  return (
    <nav className="no-print mt-6 grid gap-2 md:grid-cols-4">
      {PASOS_CONFIGURAR.map((p) => {
        const href = `/organizaciones/${slug}/${p.key}`;
        const activo = pathname.startsWith(href);
        const hecho = hechos[p.key];
        return (
          <Link
            key={p.key}
            href={href}
            className={`relative rounded-[4px] border px-4 py-3 transition ${
              activo
                ? "border-accent bg-[rgba(111,191,178,0.1)]"
                : "border-[rgba(232,227,216,0.12)] hover:border-[rgba(111,191,178,0.5)]"
            }`}
          >
            <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-[#7f8f8c]">
              <span
                className={`grid h-5 w-5 place-items-center rounded-full text-[10px] font-semibold ${
                  hecho ? "bg-accent text-accentDeep" : activo ? "border border-accent text-accent" : "border border-[#4d5a58] text-[#7f8f8c]"
                }`}
              >
                {hecho ? "✓" : p.n}
              </span>
              {p.nivel}
            </span>
            <span className={`mt-1.5 block text-[13.5px] font-semibold ${activo ? "text-accent" : "text-[#e8e3d8]"}`}>
              {p.nombre}
            </span>
            <span className="mt-0.5 block text-[11px] leading-snug text-[#7f8f8c]">{p.proposito}</span>
          </Link>
        );
      })}
    </nav>
  );
}
