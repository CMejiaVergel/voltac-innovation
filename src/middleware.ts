import { NextResponse, type NextRequest } from "next/server";

import { RUTAS_V1_OCULTAS, V2 } from "@/lib/v2";

/**
 * En la v2 las etapas de la version anterior quedan ocultas mientras se
 * rediseñan: quien llegue por un enlace viejo cae en Configurar del mismo
 * proyecto. Los datos siguen en la base; solo se esconde la interfaz.
 */
export function middleware(req: NextRequest) {
  if (!V2) return NextResponse.next();
  const [, , slug, etapa] = req.nextUrl.pathname.split("/");
  if (slug && slug !== "nuevo" && etapa && (RUTAS_V1_OCULTAS as readonly string[]).includes(etapa)) {
    return NextResponse.redirect(new URL(`/proyectos/${slug}/configurar`, req.url));
  }
  return NextResponse.next();
}

export const config = { matcher: "/proyectos/:slug/:etapa*" };
