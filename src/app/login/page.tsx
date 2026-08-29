import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth";
import { LoginForm } from "@/components/LoginForm";
import { Brand } from "@/components/Brand";

export const metadata = { title: "Ingresar — Plataforma de Innovacion Voltac" };

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) redirect("/proyectos");

  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-16">
      <div className="w-full max-w-[380px]">
        <Brand size="lg" />
        <p className="kicker mb-3 mt-7">GIM Institute · Proceso IDEX</p>
        <h1 className="text-[30px] font-bold leading-none tracking-[-0.02em] text-[#e8e3d8]">
          Plataforma de <span className="text-accent">Innovacion</span>
        </h1>
        <p className="hint mt-3">
          Mapas de Oportunidades de Negocio, agente investigador y proceso IDEX. Acceso
          restringido al equipo.
        </p>

        <div className="panel mt-7">
          <LoginForm />
        </div>

        <p className="mt-5 font-mono text-[10px] leading-relaxed text-[#4d5a58]">
          Si no tienes credenciales, pideselas al administrador de la instancia.
        </p>
      </div>
    </main>
  );
}
