import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getProjectRole, getPrimaryMap } from "@/lib/projects";

/**
 * Exportacion completa del proyecto en JSON.
 *
 * Incluye la plantilla, para que el archivo se pueda leer sin la aplicacion, y
 * el estado de verificacion de cada fragmento, que es la parte que da o quita
 * valor al contenido.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "No autenticado." }, { status: 401 });

  const project = await prisma.project.findUnique({
    where: { slug },
    include: { brief: true, sources: true, openQuestions: true },
  });
  if (!project) return NextResponse.json({ error: "No encontrado." }, { status: 404 });

  const access = await getProjectRole(user, project.id);
  if (!access) return NextResponse.json({ error: "No encontrado." }, { status: 404 });

  const primary = await getPrimaryMap(project.id);
  const fragments = primary
    ? await prisma.fragment.findMany({
        where: { mapId: primary.map.id, reviewState: { in: ["ACCEPTED", "PROPOSED"] } },
        include: { author: { select: { name: true } } },
        orderBy: [{ rowId: "asc" }, { colId: "asc" }, { position: "asc" }],
      })
    : [];

  const payload = {
    exportadoEn: new Date().toISOString(),
    proyecto: {
      slug: project.slug,
      nombre: project.name,
      empresa: project.company,
      programa: project.program,
    },
    brief: project.brief,
    plantilla: primary ? { key: primary.map.template.key, ...primary.shape } : null,
    fragmentos: fragments.map((f) => ({
      fila: f.rowId,
      columna: f.colId,
      texto: f.text,
      verificacion: f.verification,
      estadoRevision: f.reviewState,
      origen: f.origin,
      fuenteUrl: f.sourceUrl,
      fuenteCita: f.sourceCitation,
      autor: f.author?.name ?? null,
      creadoEn: f.createdAt.toISOString(),
    })),
    bibliografia: project.sources,
    preguntas: project.openQuestions,
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="bom-${slug}.json"`,
    },
  });
}
