import Link from "next/link";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requireProject, getPrimaryMap } from "@/lib/projects";
import { canEdit, RUN_STATUS_LABEL, asEnum, RUN_STATUSES, VERIFICATIONS } from "@/lib/enums";
import { agentIsConfigured, reapStaleRuns } from "@/lib/agent/run";
import { DEFAULT_MODEL } from "@/lib/agent/openrouter";
import { THIN_CELL_THRESHOLD } from "@/lib/gimi";
import { AgentLaunchForm } from "@/components/agent/AgentLaunchForm";
import { ReviewQueue } from "@/components/agent/ReviewQueue";
import { ModelPicker } from "@/components/agent/ModelPicker";
import { NotificationToggle } from "@/components/PwaClient";
import { publicKey } from "@/lib/push";

// La cola cambia por si sola cuando termina una corrida: no se cachea.
export const dynamic = "force-dynamic";

export default async function AgentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await requireUser();
  const { project, role } = await requireProject(user, slug);
  const editable = canEdit(role);

  const primary = await getPrimaryMap(project.id);
  if (!primary) return <p className="hint mt-8">Este proyecto no tiene mapa.</p>;

  await reapStaleRuns(project.id);

  const runs = await prisma.researchRun.findMany({
    where: { projectId: project.id },
    orderBy: { startedAt: "desc" },
    take: 10,
    include: {
      requestedBy: { select: { name: true } },
      _count: { select: { fragments: true } },
    },
  });

  const proposals = await prisma.fragment.findMany({
    where: { mapId: primary.map.id, reviewState: "PROPOSED" },
    orderBy: [{ createdAt: "desc" }, { rowId: "asc" }, { colId: "asc" }],
  });

  const accepted = await prisma.fragment.groupBy({
    by: ["rowId", "colId"],
    where: { mapId: primary.map.id, reviewState: "ACCEPTED" },
    _count: { _all: true },
  });

  const counts = new Map(accepted.map((a) => [`${a.rowId}|${a.colId}`, a._count._all]));
  const configured = agentIsConfigured();
  const running = runs.some((r) => r.status === "RUNNING");

  return (
    <div className="mt-7 flex flex-col gap-7 pb-16">
      {!configured && (
        <div className="rounded-[4px] border border-[rgba(217,139,63,0.45)] bg-[rgba(217,139,63,0.12)] p-4">
          <p className="text-[13px] font-semibold text-warn">El agente no esta configurado.</p>
          <p className="hint mt-1.5">
            Falta <code className="font-mono text-[11.5px]">OPENROUTER_API_KEY</code> en el
            entorno del servidor. Sin ella el resto de la aplicacion funciona con normalidad;
            solo el llenado automatico queda deshabilitado.
          </p>
        </div>
      )}

      {/* ── Reglas del agente ────────────────────────────────────────────── */}
      <section className="panel">
        <h2 className="kicker mb-3">Que hace y que no hace el agente</h2>
        <div className="grid gap-6 text-[12.5px] leading-relaxed text-[#93a09e] md:grid-cols-2">
          <div>
            <p className="mb-2 text-[#cbd4d2]">Hace</p>
            <ul className="flex list-disc flex-col gap-1.5 pl-4">
              <li>Busca en la web y recolecta observaciones crudas, una idea por fragmento.</li>
              <li>Declara el estado de verificacion de cada una y adjunta la URL consultada.</li>
              <li>
                En Adyacencias busca fuera del sector y describe el mecanismo, no la empresa.
              </li>
              <li>
                Lo que no puede verificar lo devuelve como pregunta para la empresa, no como
                dato.
              </li>
            </ul>
          </div>
          <div>
            <p className="mb-2 text-[#cbd4d2]">No hace</p>
            <ul className="flex list-disc flex-col gap-1.5 pl-4">
              <li>No escribe insights ni conclusiones dentro del mapa.</li>
              <li>No relaciona fragmentos entre si.</li>
              <li>No inventa cifras, fechas ni nombres.</li>
              <li>No rellena por cuota: prefiere entregar menos y reportar la celda vacia.</li>
              <li>Nada entra al mapa sin que una persona lo acepte.</li>
            </ul>
          </div>
        </div>
      </section>

      {/* ── Modelo ───────────────────────────────────────────────────────── */}
      <section className="panel">
        <h2 className="kicker mb-1">Motor de IA</h2>
        <p className="hint mb-4">
          Esta tarea no necesita un modelo grande: hay que seguir un reglamento, buscar y
          devolver JSON con frases cortas. Empieza barato y sube solo si los fragmentos salen
          pobres. Los precios los publica OpenRouter en vivo.
        </p>
        <ModelPicker
          slug={slug}
          currentModel={project.agentModel}
          envDefault={process.env.OPENROUTER_MODEL?.trim() || DEFAULT_MODEL}
          webSearch={project.agentWebSearch}
          editable={editable}
        />

        <div className="mt-6 border-t border-[rgba(232,227,216,0.1)] pt-5">
          <h3 className="kicker mb-3">Avisarme cuando termine</h3>
          <NotificationToggle vapidKey={publicKey()} />
        </div>
      </section>

      {/* ── Lanzamiento ──────────────────────────────────────────────────── */}
      {editable && (
        <section className="panel">
          <h2 className="kicker mb-4">Lanzar una investigacion</h2>
          {!project.brief?.challengeText && (
            <p className="mb-4 text-[12.5px] text-warn">
              El brief esta vacio. El agente trabajara casi a ciegas.{" "}
              <Link href={`/proyectos/${slug}/brief`} className="underline">
                Completalo primero
              </Link>
              .
            </p>
          )}
          <AgentLaunchForm
            slug={slug}
            shape={primary.shape}
            counts={Object.fromEntries(counts)}
            thinThreshold={THIN_CELL_THRESHOLD}
            disabled={!configured || running}
            running={running}
          />
        </section>
      )}

      {/* ── Cola de revision ─────────────────────────────────────────────── */}
      <section>
        <div className="mb-4 flex items-baseline gap-3">
          <h2 className="kicker">Cola de revision</h2>
          <span className="font-mono text-[11px] text-[#5e7370]">
            {proposals.length} sin revisar
          </span>
          <span className="flex-1" />
          <Link href={`/proyectos/${slug}/bom`} className="btn">
            Verlas sobre el mapa
          </Link>
        </div>

        {proposals.length === 0 ? (
          <p className="hint">
            No hay nada pendiente. Lo que el agente proponga aparece aqui y en el mapa como
            papelito amarillo, hasta que alguien lo acepte o lo descarte.
          </p>
        ) : (
          <ReviewQueue
            slug={slug}
            shape={primary.shape}
            editable={editable}
            proposals={proposals.map((p) => ({
              id: p.id,
              rowId: p.rowId,
              colId: p.colId,
              text: p.text,
              verification: asEnum(VERIFICATIONS, p.verification, "TO_CONFIRM"),
              sourceUrl: p.sourceUrl,
              sourceCitation: p.sourceCitation,
              agentRationale: p.agentRationale,
            }))}
          />
        )}
      </section>

      {/* ── Historial de corridas ────────────────────────────────────────── */}
      <section>
        <h2 className="kicker mb-4">Corridas recientes</h2>
        {runs.length === 0 ? (
          <p className="hint">Todavia no se ha corrido el agente en este proyecto.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {runs.map((r) => {
              const status = asEnum(RUN_STATUSES, r.status, "DONE");
              return (
                <li
                  key={r.id}
                  className="flex flex-wrap items-baseline gap-x-4 gap-y-1 rounded-[3px] border border-[rgba(232,227,216,0.1)] bg-panel px-4 py-3"
                >
                  <span
                    className={`font-mono text-[10px] uppercase tracking-[0.12em] ${
                      status === "ERROR"
                        ? "text-danger"
                        : status === "RUNNING"
                          ? "text-warn"
                          : "text-accent"
                    }`}
                  >
                    {RUN_STATUS_LABEL[status]}
                  </span>
                  <span className="text-[12.5px] text-[#c0ccca]">
                    {r._count.fragments} fragmento{r._count.fragments === 1 ? "" : "s"}
                  </span>
                  <span className="font-mono text-[10.5px] text-[#5e7370]">
                    {r.webSearches} resultados web · {r.inputTokens + r.outputTokens} tokens
                    {r.costUsd !== null ? ` · $${r.costUsd.toFixed(4)}` : ""} · {r.model}
                  </span>
                  <span className="font-mono text-[10.5px] text-[#4d5a58]">
                    {r.requestedBy.name} · {r.startedAt.toLocaleString("es-CO")}
                  </span>
                  {r.error && (
                    <p className="w-full text-[11.5px] leading-relaxed text-[#c98b7a]">
                      {r.error}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
