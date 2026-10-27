import { PaginaPublica } from "@/components/cuentas/PaginaPublica";
import { FormActivar } from "@/components/cuentas/Formularios";

export const metadata = { title: "Activar cuenta — Plataforma de Innovación Voltac", robots: { index: false } };

/**
 * La activación se confirma con un botón y no al abrir el enlace: algunos
 * filtros de correo abren los enlaces para revisarlos, y eso no debe gastar
 * el token.
 */
export default async function ActivarPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <PaginaPublica titulo="Activa tu cuenta">
      <FormActivar token={token} />
    </PaginaPublica>
  );
}
