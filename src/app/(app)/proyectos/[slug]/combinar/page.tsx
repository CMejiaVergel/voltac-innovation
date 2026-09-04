import Link from "next/link";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requireProject, getPrimaryMap } from "@/lib/projects";
import { canEdit, asEnum, VERIFICATIONS, DOT_ROLES, REVIEW_STATES } from "@/lib/enums";
import { CombinarBoard } from "@/components/combinar/CombinarBoard";
import type { InsightVista, Punto } from "@/components/combinar/types";

export default async function CombinarPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await requireUser();
  const { project, role } = await requireProject(user, slug);

  const primary = await getPrimaryMap(project.id);
  if (!primary) {
    return (
      <div className="panel mt-8">
        <p className="hint">Este proyecto no tiene un mapa creado.</p>
      </div>
    );
  }

  // Solo entran al mapa de puntos los fragmentos ACEPTADOS y visibles. Una
  // propuesta del agente sin revisar no puede sostener un insight: primero se
  // acepta en Divergir, despues se combina.
  const rows = await prisma.fragment.findMany({
    where: { mapId: primary.map.id, reviewState: "ACCEPTED", hidden: false },
    orderBy: [{ rowId: "asc" }, { colId: "asc" }, { position: "asc" }],
    select: {
      id: true,
      rowId: true,
      colId: true,
      text: true,
      verification: true,
    },
  });

  const puntos: Punto[] = rows.map((f) => ({
    id: f.id,
    rowId: f.rowId,
    colId: f.colId,
    text: f.text,
    verification: asEnum(VERIFICATIONS, f.verification, "TO_CONFIRM"),
  }));

  const vivos = new Set(puntos.map((p) => p.id));

  const filas = await prisma.insight.findMany({
    where: { projectId: project.id },
    include: {
      dots: { orderBy: { position: "asc" } },
      ideas: { orderBy: { position: "asc" } },
    },
    orderBy: { position: "asc" },
  });

  const insights: InsightVista[] = filas.map((i) => ({
    id: i.id,
    tag: i.tag,
    statement: i.statement,
    fact: i.fact,
    counterpart: i.counterpart,
    shift: i.shift,
    offerWho: i.offerWho,
    offerProof: i.offerProof,
    payWho: i.payWho,
    payProof: i.payProof,
    business: i.business,
    limitNote: i.limitNote,
    reviewState: asEnum(REVIEW_STATES, i.reviewState, "ACCEPTED"),
    origin: i.origin === "AGENT" ? "AGENT" : "HUMAN",
    hidden: i.hidden,
    position: i.position,
    dots: i.dots.map((d) => ({
      id: d.id,
      fragmentId: d.fragmentId,
      textSnapshot: d.textSnapshot,
      rowId: d.rowId,
      colId: d.colId,
      role: asEnum(DOT_ROLES, d.role, "APOYO"),
      position: d.position,
      // Huerfano tambien si el fragmento sigue existiendo pero ya no esta en
      // el mapa visible: se oculto o se rechazo despues de conectarlo.
      huerfano: !d.fragmentId || !vivos.has(d.fragmentId),
    })),
    ideas: i.ideas.map((n) => ({
      id: n.id,
      text: n.text,
      origin: n.origin === "AGENT" ? "AGENT" : "HUMAN",
    })),
  }));

  return (
    <div className="mt-7">
      <div className="mb-6 max-w-[70ch]">
        <p className="kicker mb-2">Etapa 3 · Combinar</p>
        <p className="hint">
          Aqui se conectan puntos del mapa hasta que aparece una revelacion que ninguno decia por
          separado. Las columnas son las cinco dimensiones del negocio: el libro de GIMI las
          llama las piezas del rompecabezas, y pide una frase que las combine.{" "}
          {puntos.length === 0 && (
            <>
              Este mapa aun no tiene fragmentos aceptados:{" "}
              <Link href={`/proyectos/${slug}/bom`} className="text-accent underline">
                vuelve a Divergir
              </Link>{" "}
              para llenarlo primero.
            </>
          )}
        </p>
      </div>

      <CombinarBoard
        slug={slug}
        shape={primary.shape}
        puntos={puntos}
        insights={insights}
        editable={canEdit(role)}
      />
    </div>
  );
}
