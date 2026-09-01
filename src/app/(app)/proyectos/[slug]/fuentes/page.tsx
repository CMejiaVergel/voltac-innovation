import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requireProject } from "@/lib/projects";
import { canEdit, asEnum, QUESTION_STATUSES } from "@/lib/enums";
import { addOpenQuestion, addSource } from "@/app/actions/projects";
import { QuestionList } from "@/components/QuestionList";

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
      // El orden lo fija el equipo: las flechas de la lista escriben `position`.
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
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
          Lo que no se pudo verificar vive aqui, no como dato en el mapa. No todas son para la
          empresa: varias las resuelve el propio equipo investigando, y por eso cada una dice
          quien deberia responderla.
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
                list="responsables-alta"
                className="field flex-1"
                placeholder="Quien la resuelve (ej. Equipo Voltac, Cabot, Cardique)"
              />
              <datalist id="responsables-alta">
                <option value="Equipo Voltac (investigacion propia)" />
                <option value="Cabot" />
                <option value="Acuacar" />
                <option value="Cardique / EPA Cartagena" />
                <option value="Fundacion Mamonal / ANDI Bolivar" />
                <option value="Asesor juridico ambiental" />
              </datalist>
              <button type="submit" className="btn btn-primary">
                Agregar
              </button>
            </div>
          </form>
        )}

        <QuestionList
          slug={slug}
          editable={editable}
          questions={questions.map((q) => ({
            id: q.id,
            text: q.text,
            askedTo: q.askedTo,
            status: asEnum(QUESTION_STATUSES, q.status, "OPEN"),
            answer: q.answer,
            origin: q.origin === "AGENT" ? ("AGENT" as const) : ("HUMAN" as const),
          }))}
        />
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
