import Link from "next/link";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requireProject, getPrimaryMap } from "@/lib/projects";
import { IDEX, HATS, THIN_CELL_THRESHOLD } from "@/lib/gimi";
import { VERIFICATION_META, type Verification } from "@/lib/enums";

export default async function ProjectOverview({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await requireUser();
  const { project } = await requireProject(user, slug);
  const primary = await getPrimaryMap(project.id);

  const fragments = primary
    ? await prisma.fragment.findMany({
        where: { mapId: primary.map.id },
        select: { rowId: true, colId: true, verification: true, reviewState: true },
      })
    : [];

  const accepted = fragments.filter((f) => f.reviewState === "ACCEPTED");
  const proposed = fragments.filter((f) => f.reviewState === "PROPOSED").length;

  const byVerification = (v: Verification) =>
    accepted.filter((f) => f.verification === v).length;

  // Celdas poco exploradas: la señal metodologica de que un lente no se miro.
  let thin = 0;
  let empty = 0;
  const totalCells = primary ? primary.shape.rows.length * primary.shape.cols.length : 0;
  if (primary) {
    for (const r of primary.shape.rows) {
      for (const c of primary.shape.cols) {
        const n = accepted.filter((f) => f.rowId === r.id && f.colId === c.id).length;
        if (n === 0) empty++;
        else if (n < THIN_CELL_THRESHOLD) thin++;
      }
    }
  }

  const openQuestions = await prisma.openQuestion.count({
    where: { projectId: project.id, status: "OPEN" },
  });
  const sources = await prisma.source.count({ where: { projectId: project.id } });

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="flex flex-col gap-6">
        {/* ── Estado del mapa ─────────────────────────────────────────────── */}
        <section className="panel">
          <h2 className="kicker mb-4">Estado del Mapa de Oportunidades</h2>

          <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
            <Stat n={accepted.length} label="fragmentos en el mapa" />
            <Stat n={proposed} label="propuestos sin revisar" highlight={proposed > 0} />
            <Stat n={empty} label={`celdas vacias de ${totalCells}`} />
            <Stat n={thin} label={`celdas con menos de ${THIN_CELL_THRESHOLD}`} />
          </div>

          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2">
            {(["VERIFIED", "TO_CONFIRM", "ASSUMPTION"] as Verification[]).map((v) => (
              <span key={v} className="flex items-center gap-2 text-[12px] text-[#8b9a97]">
                <span style={{ color: VERIFICATION_META[v].color }}>
                  {VERIFICATION_META[v].dot}
                </span>
                <b className="font-mono text-[12px] text-[#c0ccca]">{byVerification(v)}</b>
                {VERIFICATION_META[v].label.toLowerCase()}
              </span>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <Link href={`/proyectos/${slug}/bom`} className="btn btn-primary">
              Abrir el mapa
            </Link>
            {proposed > 0 && (
              <Link href={`/proyectos/${slug}/agente`} className="btn">
                Revisar {proposed} propuesta{proposed === 1 ? "" : "s"}
              </Link>
            )}
          </div>
        </section>

        {/* ── Reto ────────────────────────────────────────────────────────── */}
        <section className="panel">
          <h2 className="kicker mb-3">Reto</h2>
          {project.brief?.challengeText ? (
            <blockquote className="border-l-2 border-accent pl-4 text-[14px] leading-relaxed text-[#d5dcda]">
              {project.brief.challengeText}
            </blockquote>
          ) : (
            <p className="hint">
              Todavia no se registro el reto textual.{" "}
              <Link href={`/proyectos/${slug}/brief`} className="text-accent underline">
                Completar el brief
              </Link>
              .
            </p>
          )}
          {project.brief?.meta && (
            <>
              <h3 className="kicker mb-2 mt-5">Meta</h3>
              <p className="text-[13px] leading-relaxed text-[#a9b5b3]">{project.brief.meta}</p>
            </>
          )}
        </section>

        {/* ── Trazabilidad ────────────────────────────────────────────────── */}
        <section className="panel">
          <h2 className="kicker mb-4">Trazabilidad</h2>
          <div className="grid grid-cols-2 gap-5">
            <Stat n={sources} label="fuentes en la bibliografia" />
            <Stat n={openQuestions} label="preguntas sin responder" highlight={openQuestions > 0} />
          </div>
          <p className="hint mt-4">
            Toda afirmacion del mapa debe poder rastrearse a una fuente. Lo que no se pudo
            verificar vive en el banco de preguntas, no como dato en el mapa.
          </p>
          <Link href={`/proyectos/${slug}/fuentes`} className="btn mt-4">
            Ver fuentes y preguntas
          </Link>
        </section>
      </div>

      {/* ── Proceso IDEX ──────────────────────────────────────────────────── */}
      <aside className="panel h-fit">
        <h2 className="kicker mb-1">Proceso IDEX</h2>
        <p className="hint mb-5 text-[11.5px]">
          Metodologia del GIM Institute. Cada etapa tiene sus sombreros de pensamiento.
        </p>

        <ol className="flex flex-col gap-4">
          {IDEX.map((stage) => (
            <li key={stage.key} className="border-l-2 pl-3" style={{ borderColor: stage.implemented ? "#6FBFB2" : "rgba(232,227,216,0.14)" }}>
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-[10px] text-[#5e7370]">{stage.n}</span>
                {stage.implemented && stage.route ? (
                  <Link
                    href={`/proyectos/${slug}/${stage.route}`}
                    className="text-[13.5px] font-semibold text-[#e8e3d8] hover:text-accent"
                  >
                    {stage.name}
                  </Link>
                ) : (
                  <span className="text-[13.5px] font-semibold text-[#5e7370]">
                    {stage.name}
                  </span>
                )}
                {!stage.implemented && (
                  <span className="font-mono text-[9px] uppercase tracking-wider text-[#4d5a58]">
                    proximo
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-[11.5px] text-[#8b9a97]">{stage.purpose}</p>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {stage.hats.map((h) => (
                  <span
                    key={h}
                    title={`Sombrero ${HATS[h].name}: ${HATS[h].trait}`}
                    className="inline-block h-2.5 w-2.5 rounded-full border border-black/30"
                    style={{ background: HATS[h].color }}
                  />
                ))}
              </div>
            </li>
          ))}
        </ol>
      </aside>
    </div>
  );
}

function Stat({ n, label, highlight }: { n: number; label: string; highlight?: boolean }) {
  return (
    <div>
      <div
        className={`font-mono text-[26px] leading-none ${
          highlight ? "text-warn" : "text-[#e8e3d8]"
        }`}
      >
        {n}
      </div>
      <div className="mt-1.5 text-[11px] leading-tight text-[#7f8f8c]">{label}</div>
    </div>
  );
}
