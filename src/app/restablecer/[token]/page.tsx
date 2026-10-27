import { prisma } from "@/lib/db";
import { hashToken } from "@/lib/seguridad";
import { PaginaPublica } from "@/components/cuentas/PaginaPublica";
import { FormRestablecer } from "@/components/cuentas/Formularios";

export const metadata = { title: "Nueva contraseña — Plataforma de Innovación Voltac", robots: { index: false } };

export default async function RestablecerPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const t = await prisma.tokenCuenta.findUnique({ where: { tokenHash: hashToken(token) }, select: { tipo: true, usadoAt: true, expiresAt: true } });
  const vigente = Boolean(t && t.tipo === "RESTABLECER" && !t.usadoAt && t.expiresAt > new Date());
  return (
    <PaginaPublica titulo="Elige una contraseña nueva" bajada="Al cambiarla se cierran todas tus sesiones abiertas.">
      <FormRestablecer token={token} vigente={vigente} />
    </PaginaPublica>
  );
}
