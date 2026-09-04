import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getProjectRole } from "@/lib/projects";
import { crearRespaldo } from "@/lib/backup";

/**
 * Descarga el respaldo completo del proyecto en ZIP.
 *
 * Distinto de `/export`, que da un JSON legible para compartir. Este sirve
 * para volver atras: lleva ids, historial y lo rechazado.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "No autenticado." }, { status: 401 });

  const project = await prisma.project.findUnique({ where: { slug }, select: { id: true } });
  if (!project) return NextResponse.json({ error: "No encontrado." }, { status: 404 });

  const access = await getProjectRole(user, project.id);
  if (!access) return NextResponse.json({ error: "No encontrado." }, { status: 404 });

  const { archivo, nombre } = await crearRespaldo(project.id);

  return new NextResponse(new Uint8Array(archivo), {
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="${nombre}"`,
      "content-length": String(archivo.length),
      // Un respaldo nunca se sirve de cache: siempre refleja el estado de hoy.
      "cache-control": "no-store",
    },
  });
}
