import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getProjectRole } from "@/lib/projects";

/**
 * GET /proyectos/[slug]/presentacion/documento
 *
 * Sirve el HTML de la presentacion tal cual, para que lo cargue el iframe del
 * visor o una pestaña aparte.
 *
 * Va por el mismo origen que la aplicacion a proposito: es lo que permite que
 * el boton de PDF llame a print() dentro del iframe. Desde otro origen el
 * navegador no deja tocar el documento y no habria forma de imprimir solo la
 * presentacion.
 *
 * Y pasa por la sesion como cualquier otra pantalla: una presentacion lleva
 * dentro los insights del proyecto, que es justo lo que no puede quedar
 * colgando de una URL adivinable.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const user = await requireUser();

  const project = await prisma.project.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!project) return new NextResponse("No existe el proyecto.", { status: 404 });

  const access = await getProjectRole(user, project.id);
  if (!access) return new NextResponse("Sin acceso a este proyecto.", { status: 404 });

  const deck = await prisma.deck.findFirst({
    where: { projectId: project.id },
    orderBy: { updatedAt: "desc" },
    select: { html: true, updatedAt: true },
  });
  if (!deck) return new NextResponse("Este proyecto no tiene presentacion.", { status: 404 });

  return new NextResponse(deck.html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      // Privada: el documento es del equipo, no de ninguna cache compartida.
      "Cache-Control": "private, max-age=0, must-revalidate",
      Vary: "Cookie",
      "Last-Modified": deck.updatedAt.toUTCString(),
    },
  });
}
