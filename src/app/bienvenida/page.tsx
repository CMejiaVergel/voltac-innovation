import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PaginaPublica } from "@/components/cuentas/PaginaPublica";
import { FormPerfil } from "@/components/cuentas/Formularios";

export const metadata = { title: "Completa tu perfil — Plataforma de Innovación Voltac" };
export const dynamic = "force-dynamic";

/** Antes de entrar, cada persona deja su perfil del equipo completo: foto y rol. */
export default async function BienvenidaPage() {
  const yo = await getSessionUser();
  if (!yo) redirect("/login");
  const u = await prisma.user.findUnique({ where: { id: yo.id } });
  if (!u) redirect("/login");
  if (u.foto && u.cargo) redirect("/proyectos");
  return (
    <PaginaPublica titulo="Completa tu perfil" bajada="Tu foto, tu rol y tu formación aparecen en la presentación del equipo. Es un paso, una sola vez." ancho={520}>
      <FormPerfil nombre={u.name} cargo={u.cargo} formacion={u.formacion} fotoUrl={u.foto ? `/api/foto/${u.id}?v=${u.foto}` : null} alTerminar="/proyectos" />
    </PaginaPublica>
  );
}
