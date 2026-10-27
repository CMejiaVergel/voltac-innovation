import Link from "next/link";

import { PaginaPublica } from "@/components/cuentas/PaginaPublica";
import { FormRecuperar } from "@/components/cuentas/Formularios";

export const metadata = { title: "Recuperar contraseña — Plataforma de Innovación Voltac" };

export default function RecuperarPage() {
  return (
    <PaginaPublica titulo="Recupera tu contraseña" bajada="Te enviamos un enlace al correo de tu cuenta. Vence en 60 minutos.">
      <FormRecuperar />
      <Link href="/login" className="mt-4 inline-block text-[12px] text-accent hover:underline">
        Volver a iniciar sesión
      </Link>
    </PaginaPublica>
  );
}
