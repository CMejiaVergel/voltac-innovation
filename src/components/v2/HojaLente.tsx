"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { HOJAS_LENTE, TIPO_ESCENARIO } from "@/lib/gimi";
import { colorDePersona } from "@/lib/v2";
import { borrarElemento, guardarElemento } from "@/app/actions/organizar";

export type Elemento = {
  id: string;
  colId: string;
  tipo: string;
  nombre: string;
  detalle: string;
  impacto: number | null;
  incertidumbre: number | null;
  eje: boolean;
  authorId: string | null;
};

/**
 * La hoja de trabajo de una lente: primero se listan los actores o las
 * tendencias, después cada renglón baja ideas al mapa (IMBOK pp. 41-49).
 * «Idea al mapa» abre un post-it nuevo en esta lente con el nombre adelante.
 */
export function HojaLente({
  slug,
  colId,
  elementos,
  editable,
  onIdea,
}: {
  slug: string;
  colId: string;
  elementos: Elemento[];
  editable: boolean;
  onIdea: (texto: string) => void;
}) {
  const hoja = HOJAS_LENTE[colId];
  const router = useRouter();
  const [nuevo, setNuevo] = useState({ nombre: "", tipo: hoja?.tipos[0]?.key ?? "" });
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();
  if (!hoja) return null;

  const renglones = elementos.filter((e) => e.colId === colId && e.tipo !== TIPO_ESCENARIO);
  const escenarios = elementos.filter((e) => e.colId === colId && e.tipo === TIPO_ESCENARIO);
  const esFuturo = colId === "futuro";

  function correr(accion: () => Promise<{ ok: boolean; error?: string }>, despues?: () => void) {
    setError(null);
    startTransition(async () => {
      const r = await accion();
      if (!r.ok) return setError(r.error ?? "No se pudo guardar.");
      despues?.();
      router.refresh();
    });
  }

  function actualizar(e: Elemento, cambios: Partial<Elemento>) {
    const d = { ...e, ...cambios };
    correr(() => guardarElemento(slug, e.id, d));
  }

  const etiqueta = (tipo: string) => hoja.tipos.find((t) => t.key === tipo)?.label ?? tipo;

  return (
    <div className="mt-3 border-t border-[rgba(232,227,216,0.1)] pt-3">
      <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-[#8b9a97]">{hoja.titulo}</p>

      {hoja.tipos.map((t) => {
        const suyos = renglones.filter((e) => e.tipo === t.key);
        if (!suyos.length && hoja.tipos.length > 1 && !editable) return null;
        return (
          <div key={t.key} className="mb-2">
            {hoja.tipos.length > 1 && (
              <p className="mb-1 text-[11.5px] text-[#7f8f8c]">
                {t.grupo && <b className="text-[#a9b5b3]">{t.grupo} · </b>}
                {t.label}
              </p>
            )}
            <ul className="flex flex-col gap-1">
              {suyos.map((e) => (
                <li key={e.id} className="flex flex-wrap items-center gap-2 rounded-[4px] bg-[rgba(232,227,216,0.04)] px-2 py-1.5 text-[12.5px]">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: e.authorId ? colorDePersona(e.authorId) : "#5e7370" }} />
                  <span className="min-w-0 flex-1 text-[#e8e3d8]">{e.nombre}</span>
                  {esFuturo && (
                    <>
                      <Escala titulo="Impacto" valor={e.impacto} editable={editable} onCambiar={(v) => actualizar(e, { impacto: v })} />
                      <Escala titulo="Incertidumbre" valor={e.incertidumbre} editable={editable} onCambiar={(v) => actualizar(e, { incertidumbre: v })} />
                      <label className="flex items-center gap-1 text-[11px] text-[#a9b5b3]" title="Una de las dos tendencias con que se arman los escenarios">
                        <input type="checkbox" checked={e.eje} disabled={!editable || pendiente} onChange={() => actualizar(e, { eje: !e.eje })} />
                        Eje
                      </label>
                    </>
                  )}
                  {editable && (
                    <>
                      <button type="button" className="text-[11.5px] text-accent hover:underline" onClick={() => onIdea(`${e.nombre}: `)}>
                        + idea al mapa
                      </button>
                      <button
                        type="button"
                        className="px-1 text-[14px] leading-none text-[#5e7370] hover:text-[#e8a99c]"
                        aria-label="Quitar"
                        onClick={() => confirm(`¿Quitar «${e.nombre}» de la hoja? Los post-its que salieron de aquí se quedan en el mapa.`) && correr(() => borrarElemento(slug, e.id))}
                      >
                        ×
                      </button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </div>
        );
      })}

      {editable && (
        <form
          className="mt-2 flex flex-wrap gap-1.5"
          onSubmit={(ev) => {
            ev.preventDefault();
            if (!nuevo.nombre.trim()) return;
            correr(() => guardarElemento(slug, null, { colId, tipo: nuevo.tipo, nombre: nuevo.nombre }), () => setNuevo({ ...nuevo, nombre: "" }));
          }}
        >
          {hoja.tipos.length > 1 && (
            <select value={nuevo.tipo} onChange={(e) => setNuevo({ ...nuevo, tipo: e.target.value })} className="field !w-auto max-w-[220px] !py-1 text-[12px]">
              {hoja.tipos.map((t) => (
                <option key={t.key} value={t.key}>
                  {etiqueta(t.key).split(":")[0]}
                </option>
              ))}
            </select>
          )}
          <input
            value={nuevo.nombre}
            onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })}
            placeholder={`${hoja.nombreItem}…`}
            className="field min-w-[160px] flex-1 !py-1 text-[12.5px]"
          />
          <button type="submit" className="btn" disabled={pendiente || !nuevo.nombre.trim()}>
            Agregar
          </button>
        </form>
      )}

      {esFuturo && <Matriz tendencias={renglones} />}
      {esFuturo && (
        <Escenarios slug={slug} ejes={renglones.filter((e) => e.eje)} escenarios={escenarios} editable={editable} pendiente={pendiente} correr={correr} onIdea={onIdea} />
      )}

      {error && <p className="mt-2 text-[12px] text-[#e8a99c]">{error}</p>}
    </div>
  );
}

function Escala({ titulo, valor, editable, onCambiar }: { titulo: string; valor: number | null; editable: boolean; onCambiar: (v: number | null) => void }) {
  return (
    <label className="flex items-center gap-1 text-[11px] text-[#a9b5b3]" title={`${titulo}, de 1 (bajo) a 5 (alto)`}>
      {titulo.slice(0, 5)}.
      <select value={valor ?? ""} disabled={!editable} onChange={(e) => onCambiar(e.target.value ? Number(e.target.value) : null)} className="rounded-[3px] border border-[rgba(232,227,216,0.16)] bg-transparent px-1 text-[11.5px] text-[#e8e3d8]">
        <option value="">–</option>
        {[1, 2, 3, 4, 5].map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Matriz de impacto e incertidumbre (IMBOK p. 42; Masterclass 2, lám. 76). */
function Matriz({ tendencias }: { tendencias: Elemento[] }) {
  const ubicadas = tendencias.filter((t) => t.impacto && t.incertidumbre);
  if (!ubicadas.length) return null;
  return (
    <div className="mt-3">
      <p className="mb-1 text-[11.5px] text-[#7f8f8c]">Matriz de impacto e incertidumbre: los escenarios salen del cuadrante de arriba a la derecha.</p>
      <div className="relative ml-5 h-[180px] max-w-[360px] border-b border-l border-[rgba(232,227,216,0.3)]">
        <div className="absolute right-0 top-0 h-1/2 w-1/2 bg-[rgba(232,198,106,0.08)]" />
        <span className="absolute -left-5 top-1/2 -translate-y-1/2 -rotate-90 text-[10px] text-[#7f8f8c]">Impacto</span>
        <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[10px] text-[#7f8f8c]">Incertidumbre</span>
        {ubicadas.map((t) => (
          <span
            key={t.id}
            title={`${t.nombre} · impacto ${t.impacto}, incertidumbre ${t.incertidumbre}`}
            className="absolute max-w-[110px] -translate-x-1/2 translate-y-1/2 truncate rounded-full px-1.5 text-[10px] text-[#12181b]"
            style={{
              left: `${((t.incertidumbre! - 0.5) / 5) * 100}%`,
              bottom: `${((t.impacto! - 0.5) / 5) * 100}%`,
              background: t.eje ? "#E8C66A" : "#a9b5b3",
            }}
          >
            {t.nombre}
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * Cuatro escenarios con nombre a partir de las dos tendencias eje: cada una
 * tiene dos resultados opuestos (IMBOK pp. 43-45). De cada escenario se bajan
 * tres ideas clave al mapa.
 */
function Escenarios({
  slug,
  ejes,
  escenarios,
  editable,
  pendiente,
  correr,
  onIdea,
}: {
  slug: string;
  ejes: Elemento[];
  escenarios: Elemento[];
  editable: boolean;
  pendiente: boolean;
  correr: (a: () => Promise<{ ok: boolean; error?: string }>, despues?: () => void) => void;
  onIdea: (texto: string) => void;
}) {
  const [abierto, setAbierto] = useState<{ id: string | null; nombre: string; detalle: string } | null>(null);
  if (ejes.length < 2 && !escenarios.length) {
    return <p className="mt-3 text-[11.5px] text-[#7f8f8c]">Marque como «Eje» las dos tendencias de mayor impacto e incertidumbre para armar los escenarios.</p>;
  }
  return (
    <div className="mt-4">
      <p className="mb-1 text-[12px] font-semibold uppercase tracking-wide text-[#8b9a97]">Escenarios a 5 años</p>
      {ejes.length === 2 && (
        <p className="mb-2 text-[11.5px] text-[#7f8f8c]">
          Combine los dos resultados opuestos de <b className="text-[#a9b5b3]">{ejes[0].nombre}</b> y de <b className="text-[#a9b5b3]">{ejes[1].nombre}</b>: salen cuatro escenarios. Póngale nombre a cada uno.
        </p>
      )}
      <div className="grid gap-1.5 sm:grid-cols-2">
        {escenarios.map((e) => (
          <div key={e.id} className="rounded-[4px] border border-[rgba(232,198,106,0.35)] p-2 text-[12.5px]">
            <button type="button" className="text-left font-semibold text-[#e8e3d8] hover:underline" onClick={() => editable && setAbierto({ id: e.id, nombre: e.nombre, detalle: e.detalle })}>
              {e.nombre}
            </button>
            {e.detalle && <p className="mt-0.5 whitespace-pre-line text-[#a9b5b3]">{e.detalle}</p>}
            {editable && (
              <button type="button" className="mt-1 text-[11.5px] text-accent hover:underline" onClick={() => onIdea(`Escenario «${e.nombre}»: `)}>
                + idea al mapa
              </button>
            )}
          </div>
        ))}
        {editable && escenarios.length < 4 && (
          <button type="button" onClick={() => setAbierto({ id: null, nombre: "", detalle: "" })} className="rounded-[4px] border border-dashed border-[rgba(232,198,106,0.4)] p-2 text-[12px] text-[#E8C66A]">
            + Escenario
          </button>
        )}
      </div>
      {abierto && (
        <form
          className="mt-2 flex flex-col gap-1.5 rounded-[4px] bg-[rgba(232,227,216,0.04)] p-2"
          onSubmit={(ev) => {
            ev.preventDefault();
            correr(() => guardarElemento(slug, abierto.id, { colId: "futuro", tipo: TIPO_ESCENARIO, nombre: abierto.nombre, detalle: abierto.detalle }), () => setAbierto(null));
          }}
        >
          <input value={abierto.nombre} onChange={(e) => setAbierto({ ...abierto, nombre: e.target.value })} placeholder="Nombre del escenario" className="field !py-1 text-[13px] font-semibold" autoFocus />
          <textarea
            value={abierto.detalle}
            onChange={(e) => setAbierto({ ...abierto, detalle: e.target.value })}
            rows={3}
            placeholder="Imagine 5 años en el futuro: ¿cuál será el mercado, qué clientes y necesidades, qué productos, canales, tecnologías y aliados? ¿Quiénes son los competidores?"
            className="field resize-y text-[12.5px]"
          />
          <div className="flex gap-1.5">
            <button type="submit" className="btn btn-primary" disabled={pendiente || !abierto.nombre.trim()}>
              Guardar
            </button>
            <button type="button" className="btn" onClick={() => setAbierto(null)}>
              Cancelar
            </button>
            <span className="flex-1" />
            {abierto.id && (
              <button type="button" className="btn btn-danger" onClick={() => correr(() => borrarElemento(slug, abierto.id!), () => setAbierto(null))}>
                Quitar
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
