import Link from "next/link";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requireProject, getPrimaryMap } from "@/lib/projects";
import { canEdit, asEnum, VERIFICATIONS, REVIEW_STATES } from "@/lib/enums";
import { parseItems } from "@/lib/templates";
import { BomBoard } from "@/components/bom/BomBoard";
import type { BoardFragment } from "@/components/bom/types";

export default async function BomPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await requireUser();
  const { project, role } = await requireProject(user, slug);

  const primary = await getPrimaryMap(project.id);
  if (!primary) {
    return (
      <div className="panel mt-8">
        <p className="hint">
          Este proyecto no tiene un mapa creado.{" "}
          <Link href="/proyectos/nuevo" className="text-accent underline">
            Crea el proyecto de nuevo eligiendo plantilla
          </Link>
          .
        </p>
      </div>
    );
  }

  const rows = await prisma.fragment.findMany({
    where: { mapId: primary.map.id, reviewState: { in: ["ACCEPTED", "PROPOSED"] } },
    include: { author: { select: { name: true } } },
    orderBy: [{ rowId: "asc" }, { colId: "asc" }, { position: "asc" }],
  });

  const fragments: BoardFragment[] = rows.map((f) => ({
    id: f.id,
    rowId: f.rowId,
    colId: f.colId,
    text: f.text,
    position: f.position,
    verification: asEnum(VERIFICATIONS, f.verification, "TO_CONFIRM"),
    reviewState: asEnum(REVIEW_STATES, f.reviewState, "ACCEPTED"),
    origin: f.origin === "AGENT" ? "AGENT" : "HUMAN",
    hidden: f.hidden,
    items: parseItems(f.items),
    sourceUrl: f.sourceUrl,
    sourceCitation: f.sourceCitation,
    agentRationale: f.agentRationale,
    authorName: f.author?.name ?? null,
    updatedAt: f.updatedAt.toISOString(),
  }));

  return (
    <div className="mt-6">
      <div className="no-print mb-4 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h2 className="text-[15px] font-semibold text-[#e8e3d8]">{primary.map.name}</h2>
        <span className="font-mono text-[10.5px] text-[#5e7370]">
          {primary.map.template.name}
        </span>
        <span className="flex-1" />
        <a
          href={`/api/proyectos/${slug}/export`}
          className="btn"
          download={`bom-${slug}.json`}
        >
          Exportar JSON
        </a>
      </div>

      <BomBoard
        mapId={primary.map.id}
        slug={slug}
        shape={primary.shape}
        fragments={fragments}
        editable={canEdit(role)}
      />
    </div>
  );
}
