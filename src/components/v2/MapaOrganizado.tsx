"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { TemplateShape } from "@/lib/templates";
import { colorDePersona, tituloPostit } from "@/lib/v2";
import { agruparPostit, crearGrupo, deshacerGrupo, renombrarGrupo } from "@/app/actions/organizar";
import type { Postit } from "./MapaPostits";

export type Grupo = { id: string; rowId: string; nombre: string };

/**
 * El mapa organizado: una dimensión a la vez, los post-its de todas las lentes
 * juntos, agrupados por parecido y con una etiqueta por grupo. «Elimine los
 * duplicados, agrupe los elementos similares, etiquete cada grupo» (IMBOK
 * p. 50; Masterclass 2, lám. 91). Los duplicados se ocultan desde el post-it.
 */
export function MapaOrganizado({
  slug,
  shape,
  postits,
  grupos,
  editable,
  onAbrir,
}: {
  slug: string;
  shape: TemplateShape;
  postits: Postit[];
  grupos: Grupo[];
  editable: boolean;
  onAbrir: (id: string) => void;
}) {
  const router = useRouter();
  const [sobre, setSobre] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();
  const lente = (colId: string) => shape.cols.find((c) => c.id === colId)?.name ?? colId;

  function correr(accion: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const r = await accion();
      if (!r.ok) return setError(r.error ?? "No se pudo guardar.");
      router.refresh();
    });
  }

  function soltar(e: React.DragEvent, rowId: string, grupoId: string | null | "nuevo") {
    e.preventDefault();
    setSobre(null);
    const id = e.dataTransfer.getData("text/plain");
    const p = postits.find((x) => x.id === id);
    if (!p || p.rowId !== rowId) return setError("Un post-it solo se agrupa dentro de su dimensión.");
    if (grupoId === "nuevo") {
      // El grupo nace con el título del post-it; la etiqueta se corrige ahí mismo.
      correr(() => crearGrupo(slug, rowId, tituloPostit(p).replace(/…$/, ""), p.id));
      return;
    }
    if (p.grupoId === grupoId) return;
    correr(() => agruparPostit(slug, p.id, grupoId));
  }

  const zona = (k: string, rowId: string, grupoId: string | null | "nuevo") => ({
    onDragOver: (e: React.DragEvent) => {
      if (!editable) return;
      e.preventDefault();
      setSobre(k);
    },
    onDragLeave: () => setSobre((s) => (s === k ? null : s)),
    onDrop: (e: React.DragEvent) => soltar(e, rowId, grupoId),
  });

  function nota(p: Postit, color: string) {
    return (
      <button
        key={p.id}
        type="button"
        draggable={editable}
        onDragStart={(e) => e.dataTransfer.setData("text/plain", p.id)}
        onClick={() => onAbrir(p.id)}
        title={p.text}
        className={`relative w-full rounded-[3px] py-1.5 pl-2.5 pr-2 text-left text-[11.5px] leading-snug text-[#1d2224] shadow-[0_1px_2px_rgba(0,0,0,0.35)] ${editable ? "cursor-grab" : ""}`}
        style={{ background: `color-mix(in srgb, ${color} 28%, #f4ecd6)`, boxShadow: `inset 3px 0 0 ${p.authorId ? colorDePersona(p.authorId) : "transparent"}` }}
      >
        {p.hotspot && <span className="mr-1 text-[#b8860b]">★</span>}
        {tituloPostit(p)}
        <span className="mt-0.5 block text-[9.5px] uppercase tracking-wide text-[#5b5348]">{lente(p.colId)}</span>
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {error && <p className="rounded-[4px] border border-[rgba(142,51,36,0.5)] bg-[rgba(142,51,36,0.15)] p-3 text-[12.5px] text-[#e8a99c]">{error}</p>}
      {shape.rows.map((r) => {
        const deFila = postits.filter((p) => p.rowId === r.id);
        const gruposFila = grupos.filter((g) => g.rowId === r.id);
        const sueltos = deFila.filter((p) => !p.grupoId || !gruposFila.some((g) => g.id === p.grupoId));
        return (
          <section key={r.id}>
            <h3 className="mb-2 flex items-center gap-2 text-[13.5px] font-semibold text-[#e8e3d8]">
              <span className="h-3 w-3 rounded-sm" style={{ background: r.color }} />
              {r.name}
              <span className="text-[11px] font-normal text-[#7f8f8c]">
                {deFila.length} post-its · {gruposFila.length} grupos
              </span>
            </h3>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {gruposFila.map((g) => {
                const k = `g-${g.id}`;
                return (
                  <div key={g.id} {...zona(k, r.id, g.id)} className={`flex flex-col gap-1.5 rounded-[5px] border p-2 ${sobre === k ? "border-accent bg-[rgba(111,191,178,0.1)]" : "border-[rgba(232,227,216,0.14)] bg-[rgba(232,227,216,0.03)]"}`}>
                    <div className="flex items-center gap-1">
                      {editable ? (
                        <input
                          defaultValue={g.nombre}
                          onBlur={(e) => e.target.value.trim() && e.target.value !== g.nombre && correr(() => renombrarGrupo(slug, g.id, e.target.value))}
                          className="min-w-0 flex-1 rounded-[3px] bg-transparent px-1 text-[12.5px] font-semibold text-[#e8e3d8] outline-none focus:bg-[rgba(232,227,216,0.06)]"
                          aria-label="Etiqueta del grupo"
                        />
                      ) : (
                        <b className="flex-1 text-[12.5px] text-[#e8e3d8]">{g.nombre}</b>
                      )}
                      {editable && (
                        <button
                          type="button"
                          className="px-1 text-[14px] leading-none text-[#5e7370] hover:text-[#e8a99c]"
                          aria-label="Deshacer grupo"
                          title="Deshacer el grupo (sus post-its quedan sin agrupar)"
                          onClick={() => correr(() => deshacerGrupo(slug, g.id))}
                        >
                          ×
                        </button>
                      )}
                    </div>
                    {deFila.filter((p) => p.grupoId === g.id).map((p) => nota(p, r.color))}
                  </div>
                );
              })}
              {editable && (
                <div
                  {...zona(`n-${r.id}`, r.id, "nuevo")}
                  className={`grid min-h-[64px] place-items-center rounded-[5px] border border-dashed p-2 text-center text-[12px] ${sobre === `n-${r.id}` ? "border-accent text-accent" : "border-[rgba(111,191,178,0.4)] text-[#7f8f8c]"}`}
                >
                  Suelte aquí un post-it para abrir un grupo nuevo
                </div>
              )}
            </div>
            {sueltos.length > 0 && (
              <div {...zona(`s-${r.id}`, r.id, null)} className={`mt-2 rounded-[5px] p-2 ${sobre === `s-${r.id}` ? "bg-[rgba(111,191,178,0.08)]" : ""}`}>
                <p className="mb-1.5 text-[11.5px] text-[#7f8f8c]">Sin agrupar ({sueltos.length})</p>
                <div className="grid gap-1.5 sm:grid-cols-3 lg:grid-cols-6">{sueltos.map((p) => nota(p, r.color))}</div>
              </div>
            )}
          </section>
        );
      })}
      {pendiente && <span className="sr-only">Guardando…</span>}
    </div>
  );
}
