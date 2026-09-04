import Link from "next/link";

import { requireUser } from "@/lib/auth";
import { logoutAction } from "@/app/actions/auth";
import { Brand } from "@/components/Brand";
import { MobileTabBar } from "@/components/MobileTabBar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  return (
    <div className="min-h-screen">
      <header
        className="no-print sticky top-0 z-40 border-b border-[rgba(232,227,216,0.12)] bg-[rgba(18,24,27,0.95)] backdrop-blur"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="mx-auto flex max-w-[1680px] items-center gap-5 px-4 py-2.5 md:px-[18px]">
          <Link href="/proyectos" aria-label="Inicio">
            <Brand />
          </Link>

          {/* En movil la navegacion vive en la barra inferior. */}
          <nav className="hidden items-center gap-4 text-[12px] text-[#8b9a97] md:flex">
            <Link href="/proyectos" className="transition hover:text-white">
              Proyectos
            </Link>
            <Link href="/guia" className="transition hover:text-white">
              Guia
            </Link>
            {user.role === "ADMIN" && (
              <Link href="/admin/usuarios" className="transition hover:text-white">
                Administracion
              </Link>
            )}
          </nav>

          <div className="flex-1" />

          <Link
            href="/cuenta"
            title="Tu cuenta y tu clave de OpenRouter"
            className="hidden font-mono text-[11px] text-[#5e7370] transition hover:text-white sm:inline"
          >
            {user.name}
          </Link>
          <form action={logoutAction}>
            <button type="submit" className="btn px-2.5 py-1 text-[11px] md:px-3 md:py-1.5 md:text-[12px]">
              Salir
            </button>
          </form>
        </div>
      </header>

      {/* pb-24 en movil deja sitio a la barra inferior de pestañas. */}
      <main className="mx-auto max-w-[1680px] px-4 pb-24 md:px-[18px] md:pb-20">{children}</main>

      <MobileTabBar />
    </div>
  );
}
