import Link from "next/link";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requireProject, getPrimaryMap } from "@/lib/projects";
import { canEdit, asEnum, colorDeTrazo, VERIFICATIONS, VERIFICATION_META } from "@/lib/enums";
import { MapaPostits, type InsightMapa, type Postit } from "@/components/v2/MapaPostits";
import { SugerirTitulos } from "@/components/v2/SugerirTitulos";

export default async function DivergirPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await requireUser();
  const { project, role } = await requireProject(user, slug);
  const primary = await getPrimaryMap(project.id);
  if (!primary) {
    return <p className="hint mt-8">Este proyecto no tiene mapa.</p>;
  }

  const filas = await prisma.fragment.findMany({
    where: { mapId: primary.map.id, reviewState: "ACCEPTED", hidden: false },
    include: { author: { select: { name: true } } },
    orderBy: [{ rowId: "asc" }, { colId: "asc" }, { position: "asc" }],
  });
  const postits: Postit[] = filas.map((f) => ({
    id: f.id,
    rowId: f.rowId,
    colId: f.colId,
    titulo: f.titulo,
    text: f.text,
    verification: asEnum(VERIFICATIONS, f.verification, "TO_CONFIRM"),
    sourceUrl: f.sourceUrl,
    sourceCitation: f.sourceCitation,
    authorId: f.authorId,
    authorName: f.author?.name ?? null,
    grupoId: f.grupoId,
    hotspot: f.hotspot,
  }));

  const grupos = await prisma.grupoMapa.findMany({
    where: { mapId: primary.map.id },
    orderBy: { position: "asc" },
    select: { id: true, rowId: true, nombre: true },
  });
  const elementos = await prisma.elementoLente.findMany({
    where: { projectId: project.id },
    orderBy: { position: "asc" },
    select: { id: true, colId: true, tipo: true, nombre: true, detalle: true, impacto: true, incertidumbre: true, eje: true, authorId: true },
  });

  // Los insights se dibujan sobre los post-its que los sostienen. Solo cuentan
  // los puntos cuyo post-it sigue visible en el mapa.
  const visibles = new Set(postits.map((p) => p.id));
  const filasInsight = await prisma.insight.findMany({
    where: { projectId: project.id, reviewState: "ACCEPTED", hidden: false },
    include: { dots: { orderBy: { position: "asc" } }, author: { select: { name: true } } },
    orderBy: { position: "asc" },
  });
  const insights: InsightMapa[] = filasInsight.map((i, n) => ({
    id: i.id,
    n: n + 1,
    color: colorDeTrazo(i.color, n),
    statement: i.statement,
    fact: i.fact,
    pattern: i.pattern,
    implication: i.implication,
    business: i.business,
    limitNote: i.limitNote,
    fragmentIds: i.dots.map((d) => d.fragmentId).filter((id): id is string => !!id && visibles.has(id)),
    authorId: i.authorId,
    authorName: i.author?.name ?? null,
  }));

  const celdas = primary.shape.rows.length * primary.shape.cols.length;
  const llenas = new Set(postits.map((p) => `${p.rowId}|${p.colId}`)).size;

  return (
    <div className="mt-6 pb-16">
      <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px] text-[#8b9a97]">
        <span>
          <b className="text-[15px] text-[#e8e3d8]">{postits.length}</b> post-its
        </span>
        <span>
          <b className="text-[15px] text-[#e8e3d8]">{llenas}</b> de {celdas} celdas con material
        </span>
        <span>
          <b className="text-[15px] text-[#e8e3d8]">{insights.length}</b> insights
        </span>
        {canEdit(role) && <SugerirTitulos mapId={primary.map.id} sinTitulo={postits.filter((p) => !p.titulo).length} />}
        <span className="flex-1" />
        {postits.length > 0 && (
          <Link href={`/proyectos/${slug}/plataformas`} className="btn btn-primary order-last md:order-none">
            Plataformas de crecimiento →
          </Link>
        )}
        {VERIFICATIONS.map((v) => (
          <span key={v} className="hidden items-center gap-1.5 md:flex">
            <span className="h-2 w-2 rounded-full" style={{ background: VERIFICATION_META[v].color }} />
            {VERIFICATION_META[v].label}
          </span>
        ))}
      </div>
      <MapaPostits slug={slug} mapId={primary.map.id} shape={primary.shape} postits={postits} insights={insights} grupos={grupos} elementos={elementos} editable={canEdit(role)} />
    </div>
  );
}
