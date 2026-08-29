import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requireProject } from "@/lib/projects";
import { canEdit, QUESTION_STATUS_LABEL, asEnum, QUESTION_STATUSES } from "@/lib/enums";
import { addOpenQuestion, addSource, answerOpenQuestion } from "@/app/actions/projects";

export default async function SourcesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await requireUser();
  const { project, role } = await requireProject(user, slug);
  const editable = canEdit(role);

  const [sources, questions] = await Promise.all([
    prisma.source.findMany({
      where: { projectId: project.id },
      orderBy: { createdAt: "asc" },
      include: { _count: { select: { fragments: true } } },
    }),
    prisma.openQuestion.findMany({
      where: { projectId: project.id },
      orderBy: [{ status: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  const addQuestion = addOpenQuestion.bind(null, slug);
  const addSrc = addSource.bind(null, slug);

  return (
    <div className="mt-7 grid gap-8 pb-16 lg:grid-cols-2">
      {/* ── Preguntas pendientes ─────────────────────────────────────────── */}
      <section>
        <h2 className="kicker mb-2">Banco de preguntas</h2>
        <p className="hint mb-5">
          Lo que no se pudo verificar vive aqui, no como dato en el mapa. El agente escribe en
          esta lista cuando encuentra un vacio en vez de rellenarlo con una estimacion.
        </p>

        {editable && (
          <form action={addQuestion} className="panel mb-5 flex flex-col gap-3">
            <textarea
              name="text"
              rows={2}
              required
              className="field"
              placeholder="Cual es el costo actual por m3 de agua cruda?"
            />
            <div className="flex gap-3">
              <input
                name="askedTo"
                className="field flex-1"
                placeholder="Para quien (ej. Cabot, Acuacar)"
              />
              <button type="submit" className="btn btn-primary">
                Agregar
              </button>
            </div>
          </form>
        )}

        <ul className="flex flex-col gap-3">
          {questions.map((q) => {
            const status = asEnum(QUESTION_STATUSES, q.status, "OPEN");
            const answer = answerOpenQuestion.bind(null, slug, q.id);
            return (
              <li
                key={q.id}
                className="rounded-[4px] border border-[rgba(232,227,216,0.1)] bg-panel p-4"
              >
                <div className="flex items-baseline gap-2">
                  <span
                    className={`font-mono text-[9.5px] uppercase tracking-[0.12em] ${
                      status === "OPEN" ? "text-warn" : "text-accent"
                    }`}
                  >
                    {QUESTION_STATUS_LABEL[status]}
                  </span>
                  {q.askedTo && (
                    <span className="font-mono text-[9.5px] text-[#4d5a58]">→ {q.askedTo}</span>
                  )}
                  {q.origin === "AGENT" && (
                    <span className="font-mono text-[9.5px] text-[#4d5a58]">via agente</span>
                  )}
                </div>
                <p className="mt-1.5 text-[13px] leading-relaxed text-[#d5dcda]">{q.text}</p>

                {editable ? (
                  <form action={answer} className="mt-3 flex gap-2">
                    <input
                      name="answer"
                      defaultValue={q.answer}
                      className="field flex-1 text-[12px]"
                      placeholder="Respuesta de la empresa"
                    />
                    <button type="submit" className="btn">
                      Guardar
                    </button>
                  </form>
                ) : (
                  q.answer && <p className="mt-2 text-[12px] text-[#8b9a97]">{q.answer}</p>
                )}
              </li>
            );
          })}
          {questions.length === 0 && <p className="hint">No hay preguntas registradas.</p>}
        </ul>
      </section>

      {/* ── Bibliografia ─────────────────────────────────────────────────── */}
      <section>
        <h2 className="kicker mb-2">Bibliografia</h2>
        <p className="hint mb-5">
          Toda afirmacion del mapa debe poder rastrearse hasta aqui. El agente agrega las
          fuentes que consulta.
        </p>

        {editable && (
          <form action={addSrc} className="panel mb-5 flex flex-col gap-3">
            <input name="title" required className="field" placeholder="Titulo de la fuente" />
            <input name="url" className="field" placeholder="URL" />
            <div className="flex gap-3">
              <input name="publisher" className="field flex-1" placeholder="Editor / organismo" />
              <input name="year" className="field w-24" placeholder="Año" />
            </div>
            <textarea name="note" rows={2} className="field" placeholder="Que dice y por que importa" />
            <button type="submit" className="btn btn-primary self-start">
              Agregar fuente
            </button>
          </form>
        )}

        <ul className="flex flex-col gap-3">
          {sources.map((s) => (
            <li
              key={s.id}
              className="rounded-[4px] border border-[rgba(232,227,216,0.1)] bg-panel p-4"
            >
              <div className="flex items-baseline gap-2">
                <h3 className="text-[13.5px] font-semibold text-[#e8e3d8]">{s.title}</h3>
                {s.addedBy === "AGENT" && (
                  <span className="font-mono text-[9.5px] text-[#4d5a58]">via agente</span>
                )}
                <span className="flex-1" />
                <span className="font-mono text-[9.5px] text-[#4d5a58]">
                  {s._count.fragments} frag.
                </span>
              </div>
              <p className="mt-1 font-mono text-[10.5px] text-[#5e7370]">
                {[s.publisher, s.year].filter(Boolean).join(" · ")}
              </p>
              {s.note && (
                <p className="mt-2 text-[12px] leading-relaxed text-[#8b9a97]">{s.note}</p>
              )}
              {s.url && (
                <a
                  href={s.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="mt-2 inline-block break-all text-[11.5px] text-accent underline"
                >
                  {s.url}
                </a>
              )}
            </li>
          ))}
          {sources.length === 0 && <p className="hint">La bibliografia esta vacia.</p>}
        </ul>
      </section>
    </div>
  );
}
