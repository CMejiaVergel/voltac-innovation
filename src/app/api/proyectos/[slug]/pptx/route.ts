import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getProjectRole } from "@/lib/projects";
import { generarPresentacion } from "@/lib/presentacionV2";

export const runtime = "nodejs";

/**
 * Descarga la presentación del proyecto en PPTX. Con ?concepto=<id> sale solo
 * la línea de ese concepto, para llevarla a una reunión puntual.
 */
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "No autenticado." }, { status: 401 });

  const project = await prisma.project.findUnique({ where: { slug }, select: { id: true } });
  if (!project || !(await getProjectRole(user, project.id))) {
    return NextResponse.json({ error: "No encontrado." }, { status: 404 });
  }

  const concepto = new URL(request.url).searchParams.get("concepto") ?? undefined;
  const { buffer, nombre } = await generarPresentacion(slug, concepto);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "Content-Disposition": `attachment; filename="${nombre}"`,
      "Cache-Control": "no-store",
    },
  });
}
