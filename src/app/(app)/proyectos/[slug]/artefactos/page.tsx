import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requireProject } from "@/lib/projects";
import {
  canEdit,
  asEnum,
  colorDeTrazo,
  ARTIFACT_KINDS,
  ARTIFACT_STATUSES,
  ASSUMPTION_STATUSES,
  CLAIM_KINDS,
  FEEDBACK_VERDICTS,
} from "@/lib/enums";
import { fraseConectada, TIPOS_LECCION } from "@/lib/gimi";
import { datosPromptArtefacto } from "@/lib/promptArtefactoDatos";
import { ArtifactBoard } from "@/components/artefactos/ArtifactBoard";
import { Lecciones, type LeccionVista } from "@/components/artefactos/Lecciones";
import type { ArtefactoVista, ConceptoOpcion } from "@/components/artefactos/types";

export default async function ArtefactosPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await requireUser();
  const { project, role } = await requireProject(user, slug);

  // Los insights se numeran por posicion, igual que en Combinar, para que
  // "Insight 2" signifique lo mismo en las dos pantallas.
  const insights = await prisma.insight.findMany({
    where: { projectId: project.id, reviewState: "ACCEPTED", hidden: false },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      color: true,
      position: true,
      dots: {
        orderBy: { position: "asc" },
        select: { fragment: { select: { id: true, text: true } } },
      },
    },
  });
  const porInsight = new Map(insights.map((ins, n) => [ins.id, { ins, numero: n + 1 }]));

  const conceptosDb = await prisma.concept.findMany({
    where: { projectId: project.id, hidden: false },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    include: {
      origenes: { select: { insightId: true } },
      supuestos: { orderBy: [{ likelihood: "asc" }, { position: "asc" }] },
    },
  });

  const datosPorConcepto = new Map(
    await Promise.all(conceptosDb.map(async (c) => [c.id, await datosPromptArtefacto(c.id)] as const)),
  );

  const conceptos: ConceptoOpcion[] = conceptosDb.map((c) => {
    const ids = [...new Set(c.origenes.map((o) => o.insightId).filter(Boolean))];
    const origen = ids.map((id) => porInsight.get(id)).filter((x) => x !== undefined);

    // Las cifras que se declaran HECHO solo pueden citar fragmentos que ya
    // sostienen a este concepto. Asi la cadena queda cerrada: la cifra de la
    // landing apunta al mismo punto del mapa del que salio la idea.
    const fragmentos = new Map<string, string>();
    for (const o of origen) {
      for (const d of o.ins.dots) if (d.fragment) fragmentos.set(d.fragment.id, d.fragment.text);
    }

    return {
      id: c.id,
      title: c.title,
      statement: c.statement,
      frase: fraseConectada(c),
      propuestaValor: c.propuestaValor,
      datosPrompt: datosPorConcepto.get(c.id) ?? null,
      color: colorDeTrazo(c.color, c.position),
      insights: origen.map((o) => ({ numero: o.numero, color: colorDeTrazo(o.ins.color, o.ins.position) })),
      supuestos: c.supuestos.map((s) => ({
        id: s.id,
        text: s.text,
        likelihood: s.likelihood,
        status: asEnum(ASSUMPTION_STATUSES, s.status, "OPEN"),
      })),
      fragmentos: [...fragmentos].map(([id, text]) => ({ id, text })),
    };
  });

  const filas = await prisma.artifact.findMany({
    where: { projectId: project.id },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      title: true,
      kind: true,
      promise: true,
      status: true,
      iteration: true,
      presentedTo: true,
      presentedAt: true,
      conceptId: true,
      supuestos: { select: { assumptionId: true } },
      cifras: {
        orderBy: { position: "asc" },
        include: { fragment: { select: { text: true } } },
      },
      reacciones: {
        orderBy: { createdAt: "desc" },
        include: { assumption: { select: { text: true } } },
      },
    },
  });

  // El HTML pesa megabytes: aqui solo se pregunta si existe. Lo trae el iframe.
  const conDocumento = new Set(
    (
      await prisma.artifact.findMany({
        where: { projectId: project.id, NOT: { html: "" } },
        select: { id: true },
      })
    ).map((a) => a.id),
  );

  const artefactos: ArtefactoVista[] = filas.map((a) => ({
    id: a.id,
    title: a.title,
    kind: asEnum(ARTIFACT_KINDS, a.kind, "LANDING"),
    promise: a.promise,
    status: asEnum(ARTIFACT_STATUSES, a.status, "BORRADOR"),
    iteration: a.iteration,
    presentedTo: a.presentedTo,
    presentedAt: a.presentedAt?.toISOString() ?? null,
    tieneDocumento: conDocumento.has(a.id),
    conceptId: a.conceptId,
    expuestos: a.supuestos.map((s) => s.assumptionId),
    cifras: a.cifras.map((c) => ({
      id: c.id,
      value: c.value,
      label: c.label,
      kind: asEnum(CLAIM_KINDS, c.kind, "ESTIMACION"),
      basis: c.basis,
      fragmento: c.fragment?.text ?? null,
    })),
    reacciones: a.reacciones.map((r) => ({
      id: r.id,
      source: r.source,
      text: r.text,
      verdict: r.verdict ? asEnum(FEEDBACK_VERDICTS, r.verdict, "MATIZA") : "",
      supuesto: r.assumption?.text ?? null,
      fecha: r.createdAt.toISOString(),
    })),
  }));

  const lecciones: LeccionVista[] = (
    await prisma.leccion.findMany({
      where: { projectId: project.id },
      orderBy: [{ createdAt: "asc" }, { position: "asc" }],
      select: { id: true, sesion: true, tipo: true, texto: true, hecho: true },
    })
  ).map((l) => ({ ...l, tipo: asEnum(TIPOS_LECCION, l.tipo, "APRENDIZAJE") }));

  return (
    <div className="mt-7 flex flex-col gap-8">
      <ArtifactBoard
        slug={slug}
        artefactos={artefactos}
        conceptos={conceptos}
        editable={canEdit(role)}
      />
      <Lecciones slug={slug} lecciones={lecciones} editable={canEdit(role)} />
    </div>
  );
}
