"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Barra de pestañas inferior, solo en movil.
 *
 * En pantalla pequeña la navegacion por pestañas superiores obliga a subir
 * hasta el borde de la pantalla para cambiar de seccion. La barra inferior
 * queda bajo el pulgar, que es donde el telefono espera la navegacion. Se
 * adapta al contexto: dentro de un proyecto muestra sus secciones, fuera
 * muestra las globales.
 */

type Tab = { href: string; label: string; icon: React.ReactNode };

const Icon = ({ d }: { d: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.7}
    strokeLinecap="round"
    strokeLinejoin="round"
    className="h-[21px] w-[21px]"
    aria-hidden
  >
    <path d={d} />
  </svg>
);

const ICONS = {
  grid: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
  target: "M12 3v3m0 12v3M3 12h3m12 0h3M12 7a5 5 0 100 10 5 5 0 000-10z",
  robot: "M12 3v3M7 9h10a2 2 0 012 2v6a2 2 0 01-2 2H7a2 2 0 01-2-2v-6a2 2 0 012-2zM9 14h.01M15 14h.01",
  book: "M4 5a2 2 0 012-2h12v18H6a2 2 0 01-2-2zM8 7h8M8 11h6",
  folder: "M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z",
  users: "M16 19v-1a4 4 0 00-4-4H7a4 4 0 00-4 4v1M9.5 7.5a3 3 0 106 0 3 3 0 00-6 0M21 19v-1a4 4 0 00-3-3.87",
  help: "M12 17h.01M9.1 9a3 3 0 015.8 1c0 2-3 2.5-3 4M12 21a9 9 0 100-18 9 9 0 000 18z",
  link: "M5.5 17.5 10 11l4.5 3.5L19 6M5.5 17.5a1.6 1.6 0 100-3.2 1.6 1.6 0 000 3.2zM10 12.6a1.6 1.6 0 100-3.2 1.6 1.6 0 000 3.2zM14.5 16.1a1.6 1.6 0 100-3.2 1.6 1.6 0 000 3.2zM19 7.6a1.6 1.6 0 100-3.2 1.6 1.6 0 000 3.2z",
};

function projectTabs(slug: string): Tab[] {
  const base = `/proyectos/${slug}`;
  return [
    { href: `${base}/bom`, label: "Mapa", icon: <Icon d={ICONS.grid} /> },
    { href: `${base}/combinar`, label: "Combinar", icon: <Icon d={ICONS.link} /> },
    { href: `${base}/brief`, label: "Reto", icon: <Icon d={ICONS.target} /> },
    { href: `${base}/agente`, label: "Agente", icon: <Icon d={ICONS.robot} /> },
    { href: `${base}/fuentes`, label: "Fuentes", icon: <Icon d={ICONS.book} /> },
    { href: `${base}/equipo`, label: "Equipo", icon: <Icon d={ICONS.users} /> },
  ];
}

const GLOBAL_TABS: Tab[] = [
  { href: "/proyectos", label: "Proyectos", icon: <Icon d={ICONS.folder} /> },
  { href: "/guia", label: "Guia", icon: <Icon d={ICONS.help} /> },
];

export function MobileTabBar() {
  const pathname = usePathname();

  const match = pathname.match(/^\/proyectos\/([^/]+)/);
  const slug = match && match[1] !== "nuevo" ? match[1] : null;
  const tabs = slug ? projectTabs(slug) : GLOBAL_TABS;

  return (
    <nav
      className="no-print fixed inset-x-0 bottom-0 z-50 border-t border-[rgba(232,227,216,0.14)] bg-[rgba(14,20,23,0.97)] backdrop-blur md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Navegacion principal"
    >
      <ul className="flex">
        {tabs.map((t) => {
          const active = pathname === t.href || pathname.startsWith(`${t.href}/`);
          return (
            <li key={t.href} className="flex-1">
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-1 py-2.5 transition ${
                  active ? "text-accent" : "text-[#6f8b87]"
                }`}
              >
                {t.icon}
                <span className="text-[10px] leading-none">{t.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
