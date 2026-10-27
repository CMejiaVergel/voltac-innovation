import { PaginaPublica } from "@/components/cuentas/PaginaPublica";
import { FormRestablecer } from "@/components/cuentas/Formularios";

export const metadata = { title: "Nueva contraseña — Plataforma de Innovación Voltac", robots: { index: false } };

export default async function RestablecerPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <PaginaPublica titulo="Elige una contraseña nueva" bajada="Al cambiarla se cierran todas tus sesiones abiertas.">
      <FormRestablecer token={token} />
    </PaginaPublica>
  );
}
