import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getProjectRole } from "@/lib/projects";

/**
 * GET /proyectos/[slug]/artefactos/[id]/documento
 *
 * Sirve el HTML del artefacto tal cual. Mismo origen que la aplicacion, por la
 * misma razon que la presentacion: es lo que permite imprimir desde el iframe.
 * Y detras de la sesion, porque un artefacto lleva dentro la solucion que el
 * equipo todavia no le ha mostrado a nadie.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string; id: string }> },
) {
  const { slug, id } = await params;
  const user = await requireUser();

  const artifact = await prisma.artifact.findFirst({
    where: { id, project: { slug } },
    select: { html: true, updatedAt: true, projectId: true },
  });
  if (!artifact || !artifact.html) {
    return new NextResponse("Este artefacto no tiene documento cargado.", { status: 404 });
  }

  const access = await getProjectRole(user, artifact.projectId);
  if (!access) return new NextResponse("Sin acceso a este proyecto.", { status: 404 });

  return new NextResponse(artifact.html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, max-age=0, must-revalidate",
      Vary: "Cookie",
      "Last-Modified": artifact.updatedAt.toUTCString(),
    },
  });
}
