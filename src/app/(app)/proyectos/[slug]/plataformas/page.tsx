import { notFound } from "next/navigation";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requireProject, getPrimaryMap } from "@/lib/projects";
import { canEdit, colorDeTrazo } from "@/lib/enums";
import { V2, leerJsonSeguro } from "@/lib/v2";
import { Plataformas, type InsightCorto, type PlataformaVista, type PuntoMapa } from "@/components/v2/Plataformas";
import type { Criterio, Desarrollo } from "@/app/actions/plataformas";

/** Paso 3 · Plataformas de Crecimiento (IMBOK pp. 51-60). */
export default async function PlataformasPage({ params }: { params: Promise<{ slug: string }> }) {
  if (!V2) notFound();
  const { slug } = await params;
  const user = await requireUser();
  const { project, role } = await requireProject(user, slug);
  const primary = await getPrimaryMap(project.id);
  if (!primary) return <p className="hint mt-8">Este proyecto no tiene mapa.</p>;

  const [fragmentos, filas, insightsDb, proyecto] = await Promise.all([
    prisma.fragment.findMany({
      where: { mapId: primary.map.id, reviewState: "ACCEPTED", hidden: false },
      include: { grupo: { select: { nombre: true } } },
      orderBy: [{ rowId: "asc" }, { hotspot: "desc" }, { position: "asc" }],
    }),
    prisma.plataforma.findMany({
      where: { projectId: project.id },
      include: { fragmentos: { select: { fragmentId: true } } },
      orderBy: { position: "asc" },
    }),
    prisma.insight.findMany({
      where: { projectId: project.id, reviewState: "ACCEPTED", hidden: false },
      orderBy: { position: "asc" },
      select: { id: true, color: true, statement: true },
    }),
    prisma.project.findUnique({ where: { id: project.id }, select: { criteriosPlataforma: true } }),
  ]);

  const puntos: PuntoMapa[] = fragmentos.map((f) => ({
    id: f.id,
    rowId: f.rowId,
    colId: f.colId,
    titulo: f.titulo,
    text: f.text,
    hotspot: f.hotspot,
    grupo: f.grupo?.nombre ?? null,
  }));
  const plataformas: PlataformaVista[] = filas.map((p) => ({
    id: p.id,
    nombre: p.nombre,
    historia: p.historia,
    alcance: p.alcance,
    seleccionada: p.seleccionada,
    priorizada: p.priorizada,
    puntajes: leerJsonSeguro<Record<string, number>>(p.puntajes, {}),
    desarrollo: leerJsonSeguro<Desarrollo>(p.desarrollo, {}),
    fragmentIds: p.fragmentos.map((f) => f.fragmentId),
    authorId: p.authorId,
  }));
  const insights: InsightCorto[] = insightsDb.map((i, n) => ({ id: i.id, n: n + 1, color: colorDeTrazo(i.color, n), statement: i.statement }));
  const criterios = leerJsonSeguro<Criterio[]>(proyecto?.criteriosPlataforma, []);

  return (
    <Plataformas
      slug={slug}
      shape={primary.shape}
      puntos={puntos}
      plataformas={plataformas}
      criterios={Array.isArray(criterios) ? criterios : []}
      insights={insights}
      editable={canEdit(role)}
    />
  );
}
