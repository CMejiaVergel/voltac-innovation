"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { QUESTION_STATUS_LABEL, type QuestionStatus } from "@/lib/enums";
import {
  updateOpenQuestion,
  deleteOpenQuestion,
  moveOpenQuestion,
} from "@/app/actions/projects";

export type Question = {
  id: string;
  text: string;
  askedTo: string;
  status: QuestionStatus;
  answer: string;
  origin: "HUMAN" | "AGENT";
};

/**
 * Banco de preguntas.
 *
 * El orden importa: una reunion con la empresa dura lo que dura, y el equipo
 * decide que preguntar primero. Por eso se pueden subir y bajar, editar cuando
 * estan mal formuladas, y borrar cuando dejan de tener sentido.
 */
export function QuestionList({
  slug,
  questions,
  editable,
}: {
  slug: string;
  questions: Question[];
  editable: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [confirmar, setConfirmar] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function correr(accion: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await accion();
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo completar la accion.");
      }
    });
  }

  if (questions.length === 0) {
    return <p className="hint">No hay preguntas registradas.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Sugerencias, no opciones cerradas: varias preguntas las resolvemos
          nosotros investigando, no preguntandole a la empresa. */}
      <datalist id="responsables-pregunta">
        <option value="Equipo Voltac (investigacion propia)" />
        <option value="Cabot" />
        <option value="Acuacar" />
        <option value="Cardique / EPA Cartagena" />
        <option value="Fundacion Mamonal / ANDI Bolivar" />
        <option value="Asesor juridico ambiental" />
      </datalist>
      {error && (
        <p className="rounded-[3px] border border-[rgba(142,51,36,0.5)] bg-[rgba(142,51,36,0.15)] px-3 py-2 text-[12px] text-[#e8a99c]">
          {error}
        </p>
      )}

      {questions.map((q, i) => {
        const editando = editandoId === q.id;

        return (
          <article
            key={q.id}
            className="rounded-[4px] border border-[rgba(232,227,216,0.1)] bg-panel p-4"
          >
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="font-mono text-[10px] text-[#4d5a58]">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span
                className={`font-mono text-[9.5px] uppercase tracking-[0.12em] ${
                  q.status === "OPEN" ? "text-warn" : "text-accent"
                }`}
              >
                {QUESTION_STATUS_LABEL[q.status]}
              </span>
              {q.askedTo && !editando && (
                <span className="font-mono text-[9.5px] text-[#4d5a58]">
                  resuelve: {q.askedTo}
                </span>
              )}
              {q.origin === "AGENT" && (
                <span className="font-mono text-[9.5px] text-[#4d5a58]">via agente</span>
              )}

              <span className="flex-1" />

              {editable && !editando && (
                <span className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={pending || i === 0}
                    onClick={() => correr(() => moveOpenQuestion(slug, q.id, "UP"))}
                    className="btn px-1.5 py-0.5 text-[11px] disabled:opacity-25"
                    aria-label="Subir"
                    title="Subir"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    disabled={pending || i === questions.length - 1}
                    onClick={() => correr(() => moveOpenQuestion(slug, q.id, "DOWN"))}
                    className="btn px-1.5 py-0.5 text-[11px] disabled:opacity-25"
                    aria-label="Bajar"
                    title="Bajar"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditandoId(q.id)}
                    className="btn px-2 py-0.5 text-[11px]"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      if (confirmar === q.id) {
                        correr(() => deleteOpenQuestion(slug, q.id));
                        setConfirmar(null);
                      } else {
                        setConfirmar(q.id);
                      }
                    }}
                    onMouseLeave={() => setConfirmar(null)}
                    className={`btn px-2 py-0.5 text-[11px] ${
                      confirmar === q.id ? "border-danger bg-danger text-white" : "btn-danger"
                    }`}
                  >
                    {confirmar === q.id ? "Confirmar" : "Eliminar"}
                  </button>
                </span>
              )}
            </div>

            {editando ? (
              <form
                action={(fd) => {
                  correr(async () => {
                    await updateOpenQuestion(slug, q.id, fd);
                    setEditandoId(null);
                  });
                }}
                className="mt-3 flex flex-col gap-2"
              >
                <textarea
                  name="text"
                  defaultValue={q.text}
                  rows={3}
                  required
                  className="field text-[13px] leading-relaxed"
                />
                <div className="flex flex-wrap gap-2">
                  <input
                    name="askedTo"
                    defaultValue={q.askedTo}
                    list="responsables-pregunta"
                    placeholder="Quien la resuelve"
                    className="field flex-1 text-[12px]"
                  />
                  <select name="status" defaultValue={q.status} className="field w-44 text-[12px]">
                    <option value="OPEN">Sin responder</option>
                    <option value="ANSWERED">Respondida</option>
                    <option value="DISCARDED">Descartada</option>
                  </select>
                </div>
                <input
                  name="answer"
                  defaultValue={q.answer}
                  placeholder="Respuesta de la empresa"
                  className="field text-[12px]"
                />
                <div className="flex gap-2">
                  <button type="submit" className="btn btn-primary" disabled={pending}>
                    Guardar
                  </button>
                  <button type="button" className="btn" onClick={() => setEditandoId(null)}>
                    Cancelar
                  </button>
                </div>
              </form>
            ) : (
              <>
                <p className="mt-1.5 text-[13px] leading-relaxed text-[#d5dcda]">{q.text}</p>
                {q.answer && (
                  <p className="mt-2 border-l-2 border-accent pl-3 text-[12.5px] leading-relaxed text-[#8b9a97]">
                    {q.answer}
                  </p>
                )}
              </>
            )}
          </article>
        );
      })}
    </div>
  );
}
