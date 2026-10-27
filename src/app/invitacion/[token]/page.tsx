import Link from "next/link";

import { prisma } from "@/lib/db";
import { hashToken } from "@/lib/seguridad";
import { PaginaPublica } from "@/components/cuentas/PaginaPublica";
import { FormAceptarInvitacion } from "@/components/cuentas/Formularios";

export const metadata = { title: "Invitación — Plataforma de Innovación Voltac", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function InvitacionPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const inv = await prisma.invitacion.findUnique({ where: { tokenHash: hashToken(token) } });
  const vigente = inv && !inv.aceptadaAt && !inv.revocadaAt && inv.expiresAt > new Date();

  // Ya aceptada: es lo que se ve justo después de crear el perfil (la página se
  // vuelve a pintar tras guardar) o al volver a abrir el enlace.
  if (inv?.aceptadaAt) {
    return (
      <PaginaPublica titulo="Tu perfil ya quedó creado">
        <p className="text-[13px] leading-relaxed text-[#c9d1cf]">
          Te enviamos un enlace de activación a <b className="text-[#e8e3d8]">{inv.email}</b>. Ábrelo para activar tu cuenta y después inicia sesión. Si no lo ves,
          revisa la carpeta de spam.
        </p>
        <Link href="/login" className="btn btn-primary mt-4 inline-flex">
          Ir a iniciar sesión
        </Link>
      </PaginaPublica>
    );
  }

  if (!vigente) {
    return (
      <PaginaPublica titulo="Esta invitación ya no sirve">
        <p className="text-[13px] text-[#c9d1cf]">Venció, ya se usó o fue revocada. Pide una nueva a quien te invitó.</p>
      </PaginaPublica>
    );
  }
  return (
    <PaginaPublica titulo="Crea tu perfil" bajada={<>Te invitaron con el correo <b className="text-[#e8e3d8]">{inv.email}</b>. Tu foto, tu rol y tu formación aparecen en la presentación del equipo.</>} ancho={520}>
      <FormAceptarInvitacion token={token} nombre={inv.nombre} />
    </PaginaPublica>
  );
}
