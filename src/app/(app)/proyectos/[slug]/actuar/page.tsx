import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requireProject } from "@/lib/projects";
import { canEdit, asEnum, ARTIFACT_KINDS, ARTIFACT_STATUSES, ASSUMPTION_STATUSES } from "@/lib/enums";
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
    },
  });

  const conceptos: ConceptoLinea[] = filas.map((c) => ({
    id: c.id,
    title: c.title,
    statement: c.statement,
    color: c.color,
    propuestaValor: c.propuestaValor,
    datos: leerActuar(c.actuar),
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
