import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requireProject } from "@/lib/projects";
import { canEdit, asEnum, colorDeTrazo, ARTIFACT_KINDS, ARTIFACT_STATUSES, ASSUMPTION_STATUSES } from "@/lib/enums";
import { avanceLinea, leerActuar } from "@/lib/actuar";
import { LineaConcepto, type ConceptoLinea } from "@/components/v2/LineaConcepto";

export default async function ActuarPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await requireUser();
  const { project, role } = await requireProject(user, slug);

  const filas = await prisma.concept.findMany({
    where: { projectId: project.id, reviewState: "ACCEPTED", hidden: false, priorizado: true },
    orderBy: { position: "asc" },
    include: {
      artefactos: { orderBy: { createdAt: "asc" } },
      supuestos: { orderBy: { position: "asc" } },
      anclas: { select: { fragmentId: true } },
    },
  });
  const insightsDb = await prisma.insight.findMany({
    where: { projectId: project.id, reviewState: "ACCEPTED", hidden: false },
    orderBy: { position: "asc" },
    select: { id: true, color: true, statement: true, dots: { select: { fragmentId: true } } },
  });
  const insights = insightsDb.map((i, n) => ({ id: i.id, n: n + 1, color: colorDeTrazo(i.color, n), statement: i.statement, fragmentIds: i.dots.map((d) => d.fragmentId) }));

  const conceptos: ConceptoLinea[] = filas.map((c) => ({
    id: c.id,
    title: c.title,
    statement: c.statement,
    color: c.color,
    propuestaValor: c.propuestaValor,
    datos: leerActuar(c.actuar),
    insights: insights
      .filter((i) => i.fragmentIds.some((f) => f && c.anclas.some((a) => a.fragmentId === f)))
      .map(({ id, n, color, statement }) => ({ id, n, color, statement })),
    artefactos: c.artefactos.map((a) => ({
      id: a.id,
      title: a.title,
      kind: asEnum(ARTIFACT_KINDS, a.kind, "PROTOCEPTO"),
      promise: a.promise,
      status: asEnum(ARTIFACT_STATUSES, a.status, "BORRADOR"),
      iteration: a.iteration,
      presentedTo: a.presentedTo,
    })),
    supuestos: c.supuestos.map((s) => ({
      id: s.id,
      text: s.text,
      likelihood: s.likelihood,
      critical: s.critical,
      failFastTest: s.failFastTest,
      expectedResult: s.expectedResult,
      trigger: s.trigger,
      status: asEnum(ASSUMPTION_STATUSES, s.status, "OPEN"),
    })),
    avance: avanceLinea({ actuar: c.actuar, propuestaValor: c.propuestaValor, artefactos: c.artefactos, supuestos: c.supuestos }),
  }));

  return (
    <div className="mt-6 pb-16">
      <LineaConcepto slug={slug} conceptos={conceptos} editable={canEdit(role)} />
    </div>
  );
}
