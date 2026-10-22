"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { PASOS_CONFIGURAR } from "@/lib/gimi";

/**
 * Los cuatro pasos de Configurar como una línea de avance. Marca lo hecho, dónde
 * está la persona y, si está en el resumen, cuál es el siguiente paso.
 */
export function PasosConfigurar({ slug, hechos }: { slug: string; hechos: Record<string, boolean> }) {
  const pathname = usePathname();
  const siguiente = PASOS_CONFIGURAR.find((p) => !hechos[p.key])?.key;
  const enUnPaso = PASOS_CONFIGURAR.some((p) => pathname.startsWith(`/organizaciones/${slug}/${p.key}`));

  return (
    <nav className="no-print mt-6" aria-label="Pasos de Configurar">
      <ol className="flex items-center">
        {PASOS_CONFIGURAR.map((p, i) => {
          const href = `/organizaciones/${slug}/${p.key}`;
          const activo = pathname.startsWith(href) || (!enUnPaso && p.key === siguiente);
          const hecho = hechos[p.key];
          return (
            <li key={p.key} className={`flex items-center ${activo ? "flex-1" : "md:flex-1"}`}>
              <Link
                href={href}
                aria-current={activo ? "step" : undefined}
                className={`flex flex-1 items-center gap-3 rounded-[4px] px-1.5 py-2.5 transition md:px-3 ${
                  activo ? "bg-[rgba(111,191,178,0.12)]" : "hover:bg-[rgba(232,227,216,0.04)]"
                }`}
              >
                <span
                  className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-[12px] font-semibold ${
                    hecho
                      ? "bg-accent text-accentDeep"
                      : activo
                        ? "border-2 border-accent text-accent"
                        : "border border-[#4d5a58] text-[#7f8f8c]"
                  }`}
                >
                  {hecho ? "✓" : p.n}
                </span>
                <span className={`min-w-0 ${activo ? "" : "hidden md:block"}`}>
                  <span className={`block text-[13.5px] font-semibold leading-tight ${activo ? "text-accent" : "text-[#e8e3d8]"}`}>
                    {p.nombre}
                  </span>
                  <span className="block truncate text-[11px] text-[#7f8f8c]">{p.proposito}</span>
                </span>
              </Link>
              {i < PASOS_CONFIGURAR.length - 1 && (
                <span className={`mx-1 h-px w-3 shrink-0 md:w-5 ${hecho ? "bg-accent" : "bg-[#3a4745]"}`} aria-hidden />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
