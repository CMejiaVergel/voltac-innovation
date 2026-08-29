import Link from "next/link";

import { requireUser } from "@/lib/auth";
import { logoutAction } from "@/app/actions/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  return (
    <div className="min-h-screen">
      <header className="no-print sticky top-0 z-50 border-b border-[rgba(232,227,216,0.12)] bg-[rgba(18,24,27,0.95)] backdrop-blur">
        <div className="mx-auto flex max-w-[1680px] items-center gap-5 px-[18px] py-3">
          <Link href="/proyectos" className="flex items-baseline gap-2">
            <span className="text-[15px] font-bold tracking-[-0.02em] text-[#e8e3d8]">
              Voltac <span className="text-accent">Innovacion</span>
            </span>
            <span className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-[#4d5a58]">
              GIMI / IDEX
            </span>
          </Link>

          <nav className="flex items-center gap-4 text-[12px] text-[#8b9a97]">
            <Link href="/proyectos" className="transition hover:text-white">
              Proyectos
            </Link>
            {user.role === "ADMIN" && (
              <Link href="/admin/usuarios" className="transition hover:text-white">
                Administracion
              </Link>
            )}
          </nav>

          <div className="flex-1" />

          <span className="font-mono text-[11px] text-[#5e7370]">{user.name}</span>
          <form action={logoutAction}>
            <button type="submit" className="btn">
              Salir
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto max-w-[1680px] px-[18px] pb-20">{children}</main>
    </div>
  );
}
