import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getProjectRole } from "@/lib/projects";
import { registrarActividad, rutaDeProyecto } from "@/lib/actividad";

export const runtime = "nodejs";

/**
 * POST /api/actividad — la señal que manda la pestaña abierta cada minuto,
 * con la ruta en la que está la persona. Solo registra proyectos a los que
 * tiene acceso.
 */
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return new NextResponse(null, { status: 401 });

  let ruta = "";
  try {
    ruta = String(((await request.json()) as { ruta?: unknown }).ruta ?? "").slice(0, 300);
  } catch {
    // Sin cuerpo: cuenta como actividad sin proyecto.
  }

  const p = rutaDeProyecto(ruta);
  let acceso: { projectId: string; etapa: string; via: "WEB" } | undefined;
  if (p) {
    const project = await prisma.project.findUnique({ where: { slug: p.slug }, select: { id: true } });
    if (project && (await getProjectRole(user, project.id))) acceso = { projectId: project.id, etapa: p.etapa.slice(0, 40), via: "WEB" };
  }
  await registrarActividad(user.id, acceso);
  return new NextResponse(null, { status: 204 });
}
