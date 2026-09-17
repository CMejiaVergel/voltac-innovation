import Link from "next/link";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requireProject } from "@/lib/projects";
import { canEdit, asEnum, colorDeTrazo, ASSUMPTION_STATUSES, REVIEW_STATES } from "@/lib/enums";
import { TARGET_SOLUTION_CONCEPTS, CONCEPTO_COMPLETO } from "@/lib/gimi";
import { parseShape } from "@/lib/templates";
import { ConvergirBoard } from "@/components/convergir/ConvergirBoard";
import type { ConceptoVista, DimensionVista, IdeaDisponible } from "@/components/convergir/types";

export default async function ConvergirPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await requireUser();
  const { project, role } = await requireProject(user, slug);

  // Las ideas vienen de los insights ACEPTADOS: una propuesta del agente sin
  // revisar no puede sostener un concepto, igual que un fragmento propuesto no
  // puede sostener un insight.
  const insights = await prisma.insight.findMany({
    where: { projectId: project.id, reviewState: "ACCEPTED", hidden: false },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      color: true,
      position: true,
      ideas: { orderBy: { position: "asc" }, select: { id: true, text: true } },
    },
  });

  const filas = await prisma.concept.findMany({
    where: { projectId: project.id },
    include: {
      origenes: { orderBy: { createdAt: "asc" } },
      supuestos: { orderBy: { position: "asc" } },
      anclas: {
        orderBy: { position: "asc" },
        include: { fragment: { select: { reviewState: true, hidden: true } } },
      },
    },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
  });

  const usadas = new Set(
    filas.flatMap((c) => c.origenes.map((o) => o.ideaId).filter((x): x is string => Boolean(x))),
  );
  const vivas = new Set(insights.flatMap((i) => i.ideas.map((x) => x.id)));

  const ideas: IdeaDisponible[] = insights.flatMap((ins, n) =>
    ins.ideas.map((idea) => ({
      id: idea.id,
      text: idea.text,
      insightId: ins.id,
      insightNumero: n + 1,
      insightColor: colorDeTrazo(ins.color, ins.position),
      usada: usadas.has(idea.id),
    })),
  );

  const conceptos: ConceptoVista[] = filas.map((c) => ({
    id: c.id,
    title: c.title,
    statement: c.statement,
    description: c.description,
    color: c.color,
    impDemanda: c.impDemanda,
    impImplementar: c.impImplementar,
    impEscalar: c.impEscalar,
    fitProblema: c.fitProblema,
    fitEquipo: c.fitEquipo,
    fitMetas: c.fitMetas,
    reviewState: asEnum(REVIEW_STATES, c.reviewState, "ACCEPTED"),
    origin: c.origin === "AGENT" ? "AGENT" : "HUMAN",
    hidden: c.hidden,
    position: c.position,
    origenes: c.origenes.map((o) => ({
      id: o.id,
      ideaId: o.ideaId,
      textSnapshot: o.textSnapshot,
      insightId: o.insightId,
      // Huerfano tambien si la idea existe pero su insight se oculto o se
      // rechazo despues: dejaria de estar disponible en Combinar.
      huerfano: !o.ideaId || !vivas.has(o.ideaId),
    })),
    anclas: c.anclas.map((a) => ({
      id: a.id,
      rowId: a.rowId,
      text: a.textSnapshot,
      huerfano: !a.fragment || a.fragment.reviewState !== "ACCEPTED" || a.fragment.hidden,
    })),
    supuestos: c.supuestos.map((s) => ({
      id: s.id,
      text: s.text,
      likelihood: s.likelihood,
      status: asEnum(ASSUMPTION_STATUSES, s.status, "OPEN"),
      note: s.note,
      questionId: s.questionId,
    })),
  }));

  const { min, max } = TARGET_SOLUTION_CONCEPTS;

  // Las dimensiones salen de la plantilla del mapa del proyecto, no de una
  // lista fija: es la misma definicion que usa el Mapa de Oportunidades.
  const mapa = await prisma.bomMap.findFirst({
    where: { projectId: project.id },
    orderBy: { createdAt: "asc" },
    select: { template: { select: { rows: true, cols: true } } },
  });
  const dimensiones: DimensionVista[] = mapa
    ? parseShape(mapa.template.rows, mapa.template.cols).rows.map((r) => ({
        id: r.id,
        name: r.name,
        color: r.color,
      }))
    : [];

  return (
    <div className="mt-7">
      <div className="mb-6 max-w-[70ch]">
        <p className="kicker mb-2">Etapa 4 · Convergir</p>
        <p className="hint">
          Aqui se estrecha. Las ideas que abrieron los insights se convierten en {min} a {max}{" "}
          conceptos de solucion, se puntuan por impacto y encaje, y se lista de que supuestos
          depende cada uno. Lo improbable de esa lista es el trabajo que queda por hacer.{" "}
          {CONCEPTO_COMPLETO.regla}{" "}
          {ideas.length === 0 && (
            <>
              Este proyecto aun no tiene ideas de las que partir:{" "}
              <Link href={`/proyectos/${slug}/combinar`} className="text-accent underline">
                vuelve a Combinar
              </Link>{" "}
              y escribe los insights primero.
            </>
          )}
        </p>
      </div>

      <ConvergirBoard
        slug={slug}
        conceptos={conceptos}
        ideas={ideas}
        dimensiones={dimensiones}
        editable={canEdit(role)}
      />
    </div>
  );
}
