"use client";

import { useState, useTransition } from "react";

import { LECCIONES, TIPOS_LECCION, type TipoLeccion } from "@/lib/gimi";
import { addLeccion, deleteLeccion, toggleLeccionHecha } from "@/app/actions/lecciones";

export type LeccionVista = {
  id: string;
  sesion: string;
  tipo: TipoLeccion;
  texto: string;
  hecho: boolean;
};

/**
 * Cierre de la sesion (Taller 3, «Experiencia de la jornada: aprendizajes y
 * diversion»). Cada quien responde tres aprendizajes y lo que mas disfruto; el
 * equipo lo consolida en una sola hoja sin repetir factores, y se cierra con
 * los siguientes pasos. Queda por sesion para poder comparar entre talleres.
 */
export function Lecciones({
  slug,
  lecciones,
  editable,
}: {
  slug: string;
  lecciones: LeccionVista[];
  editable: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const sesiones = [...new Set(lecciones.map((l) => l.sesion))];
  const [sesion, setSesion] = useState(sesiones[sesiones.length - 1] ?? "Taller 3 · Conceptos de negocio y artefactos");
  const [tipo, setTipo] = useState<TipoLeccion>("APRENDIZAJE");
  const [texto, setTexto] = useState("");

  function correr(fn: () => Promise<unknown>, despues?: () => void) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
        despues?.();
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo guardar.");
      }
    });
  }

  const orden = sesiones.includes(sesion) ? sesiones : [...sesiones, sesion];

  return (
    <section className="panel flex flex-col gap-4">
      <div className="max-w-[72ch]">
        <p className="kicker mb-1">Cierre de la sesión · lecciones aprendidas y siguientes pasos</p>
        <p className="text-[12px] leading-relaxed text-[#8b9a97]">
          {LECCIONES.tipos.APRENDIZAJE.pregunta} {LECCIONES.tipos.DISFRUTE.pregunta} {LECCIONES.regla}
        </p>
      </div>

      {orden.map((s) => {
        const suyas = lecciones.filter((l) => l.sesion === s);
        if (suyas.length === 0 && s !== sesion) return null;
        return (
          <div key={s}>
            <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-accent">{s}</p>
            <div className="mt-2 grid gap-3 md:grid-cols-3">
              {TIPOS_LECCION.map((t) => {
                const deTipo = suyas.filter((l) => l.tipo === t);
                return (
                  <div key={t} className="rounded-[4px] border border-[rgba(232,227,216,0.12)] p-2.5">
                    <p className="text-[12px] font-semibold text-[#e8e3d8]">{LECCIONES.tipos[t].label}</p>
                    <ul className="mt-1.5 flex flex-col gap-1">
                      {deTipo.map((l) => (
                        <li key={l.id} className="group flex items-start gap-2 text-[12px] leading-snug">
                          {t === "PROXIMO_PASO" ? (
                            <input
                              type="checkbox"
                              checked={l.hecho}
                              disabled={!editable || pending}
                              onChange={() => correr(() => toggleLeccionHecha(l.id))}
                              className="mt-[3px]"
                              aria-label="Hecho"
                            />
                          ) : (
                            <span className="mt-[6px] h-1.5 w-1.5 flex-none rounded-full bg-accent" />
                          )}
                          <span
                            className={`min-w-0 flex-1 ${l.hecho ? "text-[#7d8a88] line-through" : "text-[#cbd4d2]"}`}
                          >
                            {l.texto}
                          </span>
                          {editable && (
                            <button
                              type="button"
                              onClick={() => correr(() => deleteLeccion(l.id))}
                              className="px-1 text-[13px] leading-none text-[#5e7370] opacity-0 transition hover:text-[#c98b7a] group-hover:opacity-100"
                              title="Eliminar"
                            >
                              ×
                            </button>
                          )}
                        </li>
                      ))}
                      {deTipo.length === 0 && <li className="text-[11.5px] text-[#5e7370]">—</li>}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {editable && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const t = texto.trim();
            if (!t) return;
            correr(() => addLeccion(slug, { sesion, tipo, texto: t }), () => setTexto(""));
          }}
          className="flex flex-wrap gap-2"
        >
          <input
            value={sesion}
            onChange={(e) => setSesion(e.target.value)}
            placeholder="Sesión"
            className="field w-[240px] text-[12.5px]"
            list="sesiones-lecciones"
          />
          <datalist id="sesiones-lecciones">
            {sesiones.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value as TipoLeccion)}
            className="field w-auto text-[12.5px]"
          >
            {TIPOS_LECCION.map((t) => (
              <option key={t} value={t}>
                {LECCIONES.tipos[t].label}
              </option>
            ))}
          </select>
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder={LECCIONES.tipos[tipo].pregunta}
            className="field min-w-[240px] flex-1 text-[12.5px]"
          />
          <button type="submit" className="btn" disabled={pending || !texto.trim()}>
            Añadir
          </button>
        </form>
      )}
      {error && <p className="text-[12px] text-[#e8a99c]">{error}</p>}
    </section>
  );
}
