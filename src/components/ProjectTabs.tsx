"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "", label: "Vista general" },
  { href: "/brief", label: "Configurar" },
  { href: "/bom", label: "Mapa de Oportunidades" },
  { href: "/combinar", label: "Combinar" },
  { href: "/convergir", label: "Convergir" },
  { href: "/agente", label: "Agente investigador" },
  { href: "/fuentes", label: "Fuentes y preguntas" },
  { href: "/equipo", label: "Equipo" },
  { href: "/ajustes", label: "Ajustes" },
];

export function ProjectTabs({ slug }: { slug: string }) {
  const pathname = usePathname();
  const base = `/proyectos/${slug}`;

  return (
    // En movil estas pestañas se sustituyen por la barra inferior: repetirlas
    // arriba solo gasta altura de pantalla.
    <nav className="no-print mt-5 hidden flex-wrap gap-x-5 gap-y-2 border-b border-[rgba(232,227,216,0.12)] pb-0 md:flex">
      {TABS.map((t) => {
        const href = `${base}${t.href}`;
        const active = t.href === "" ? pathname === base : pathname.startsWith(href);
        return (
          <Link
            key={t.href}
            href={href}
            className={`-mb-px border-b-2 pb-2.5 text-[12.5px] transition ${
              active
                ? "border-accent font-semibold text-accent"
                : "border-transparent text-[#8b9a97] hover:text-white"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
