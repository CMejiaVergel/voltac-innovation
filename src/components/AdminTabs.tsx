"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin/usuarios", label: "Usuarios y actividad" },
  { href: "/admin/conexiones", label: "Conexión con Claude (MCP)" },
];

export function AdminTabs() {
  const ruta = usePathname();
  return (
    <nav className="flex gap-5 border-b border-[rgba(232,227,216,0.12)] text-[13px]">
      {TABS.map((t) => {
        const activa = ruta.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`-mb-px border-b-2 pb-2 transition ${activa ? "border-accent text-[#e8e3d8]" : "border-transparent text-[#8b9a97] hover:text-white"}`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
