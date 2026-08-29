"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { updateAgentSettings } from "@/app/actions/projects";

type CatalogModel = {
  id: string;
  name: string;
  contextLength: number;
  promptPerM: number | null;
  completionPerM: number | null;
  description: string;
};

/**
 * Modelos recomendados para esta tarea, en orden.
 *
 * El trabajo del agente es seguir un reglamento largo, buscar en la web y
 * devolver JSON con observaciones cortas. Pide obediencia y contexto amplio,
 * no razonamiento profundo: un modelo pequeño y barato basta.
 */
const SUGGESTED: Array<{ id: string; why: string }> = [
  {
    id: "google/gemini-2.5-flash",
    why: "Recomendado para empezar. Barato, contexto enorme (le cabe el mapa entero) y muy obediente con formatos JSON.",
  },
  {
    id: "openai/gpt-4o-mini",
    why: "Alternativa solida y previsible. Suele redactar fragmentos mas cortos y limpios.",
  },
  {
    id: "anthropic/claude-haiku-4.5",
    why: "El mas fiel al reglamento en las columnas dificiles (Adyacencias). Cuesta mas que los dos de arriba.",
  },
  {
    id: "perplexity/sonar",
    why: "Trae busqueda web propia, sin pagar el plugin aparte. Bueno si la mayor parte del gasto se te va en busquedas.",
  },
  {
    id: "deepseek/deepseek-chat",
    why: "Lo mas barato que da resultados usables. Vigila que no invente: revisa mas de cerca lo que proponga.",
  },
];

function price(m: CatalogModel): string {
  if (m.promptPerM === null) return "precio no publicado";
  if (m.promptPerM === 0 && m.completionPerM === 0) return "gratis";
  const inn = m.promptPerM.toFixed(2);
  const out = (m.completionPerM ?? 0).toFixed(2);
  return `$${inn} entrada · $${out} salida (por millon de tokens)`;
}

function ctx(m: CatalogModel): string {
  if (!m.contextLength) return "";
  return m.contextLength >= 1000
    ? `${Math.round(m.contextLength / 1000)}k contexto`
    : `${m.contextLength} contexto`;
}

export function ModelPicker({
  slug,
  currentModel,
  envDefault,
  webSearch,
  editable,
}: {
  slug: string;
  currentModel: string;
  envDefault: string;
  webSearch: boolean;
  editable: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [models, setModels] = useState<CatalogModel[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState(currentModel);
  const [search, setSearch] = useState(webSearch);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // El catalogo solo se pide cuando se abre el selector: son cientos de
  // modelos y no hace falta cargarlos para ver la pagina.
  useEffect(() => {
    if (!open || models || loadError) return;
    fetch("/api/modelos")
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.error ?? "Error al cargar modelos.");
        setModels(body.models as CatalogModel[]);
      })
      .catch((e: Error) => setLoadError(e.message));
  }, [open, models, loadError]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const results = useMemo(() => {
    if (!models) return [];
    const q = query.trim().toLowerCase();
    const list = q
      ? models.filter(
          (m) =>
            m.id.toLowerCase().includes(q) ||
            m.name.toLowerCase().includes(q) ||
            m.description.toLowerCase().includes(q),
        )
      : models;
    return list.slice(0, 80);
  }, [models, query]);

  const suggested = useMemo(() => {
    if (!models) return [];
    return SUGGESTED.map((s) => ({ ...s, model: models.find((m) => m.id === s.id) })).filter(
      (s): s is typeof s & { model: CatalogModel } => Boolean(s.model),
    );
  }, [models]);

  const effective = selected || envDefault;

  async function save(nextModel: string, nextSearch: boolean) {
    setSaving(true);
    setSaved(false);
    const fd = new FormData();
    fd.set("agentModel", nextModel);
    if (nextSearch) fd.set("agentWebSearch", "on");
    try {
      await updateAgentSettings(slug, fd);
      setSaved(true);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div ref={boxRef} className="relative">
        <span className="label">Modelo de IA</span>

        <button
          type="button"
          disabled={!editable}
          onClick={() => setOpen((v) => !v)}
          className="field flex w-full items-center justify-between gap-3 text-left disabled:opacity-60"
        >
          <span className="min-w-0 truncate font-mono text-[12.5px] text-[#dfe6e4]">
            {effective}
          </span>
          <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-[#5e7370]">
            {selected ? "cambiar" : "por defecto"}
          </span>
        </button>

        {open && (
          <div className="absolute left-0 right-0 z-50 mt-1 max-h-[420px] overflow-y-auto rounded-[4px] border border-[rgba(232,227,216,0.18)] bg-[#0e1417] shadow-[0_18px_50px_rgba(0,0,0,0.6)]">
            <div className="sticky top-0 border-b border-[rgba(232,227,216,0.12)] bg-[#0e1417] p-2">
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar modelo: gemini, haiku, sonar, mini…"
                className="field text-[12.5px]"
              />
            </div>

            {loadError && (
              <p className="p-4 text-[12px] text-[#e8a99c]">
                {loadError} Puedes escribir el identificador a mano en el campo de abajo.
              </p>
            )}
            {!models && !loadError && (
              <p className="p-4 text-[12px] text-[#5e7370]">Cargando catalogo de OpenRouter…</p>
            )}

            {models && !query && suggested.length > 0 && (
              <div className="border-b border-[rgba(232,227,216,0.1)] p-2">
                <p className="px-2 pb-1.5 pt-1 font-mono text-[9.5px] uppercase tracking-[0.14em] text-accent">
                  Recomendados para esta tarea
                </p>
                {suggested.map((s) => (
                  <Row
                    key={s.id}
                    model={s.model}
                    why={s.why}
                    active={effective === s.id}
                    onPick={() => {
                      setSelected(s.id);
                      setOpen(false);
                      void save(s.id, search);
                    }}
                  />
                ))}
              </div>
            )}

            {models && (
              <div className="p-2">
                {!query && (
                  <p className="px-2 pb-1.5 pt-1 font-mono text-[9.5px] uppercase tracking-[0.14em] text-[#5e7370]">
                    Todos ({models.length})
                  </p>
                )}
                {results.map((m) => (
                  <Row
                    key={m.id}
                    model={m}
                    active={effective === m.id}
                    onPick={() => {
                      setSelected(m.id);
                      setOpen(false);
                      void save(m.id, search);
                    }}
                  />
                ))}
                {results.length === 0 && query && (
                  <p className="p-3 text-[12px] text-[#5e7370]">
                    Ningun modelo coincide con “{query}”.
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <label className="flex items-start gap-2.5 text-[12.5px] text-[#a9b5b3]">
        <input
          type="checkbox"
          checked={search}
          disabled={!editable || saving}
          onChange={(e) => {
            setSearch(e.target.checked);
            void save(selected, e.target.checked);
          }}
          className="mt-0.5 accent-[#6FBFB2]"
        />
        <span>
          Permitir busqueda web.
          <span className="block text-[11px] text-[#5e7370]">
            Es la parte cara de una corrida: se cobra por resultado, aparte de los tokens. Sin
            ella el agente solo usa lo que ya sabe, y casi todo saldra como supuesto.
          </span>
        </span>
      </label>

      {editable && (
        <div className="flex flex-wrap items-center gap-3">
          <input
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            placeholder={`Escribir identificador a mano (por defecto: ${envDefault})`}
            className="field flex-1 font-mono text-[12px]"
          />
          <button
            type="button"
            disabled={saving}
            onClick={() => void save(selected, search)}
            className="btn"
          >
            {saving ? "Guardando…" : "Guardar"}
          </button>
          {saved && !saving && (
            <span className="font-mono text-[10.5px] text-accent">guardado</span>
          )}
        </div>
      )}
    </div>
  );
}

function Row({
  model,
  why,
  active,
  onPick,
}: {
  model: CatalogModel;
  why?: string;
  active: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      className={`block w-full rounded-[3px] px-2 py-2 text-left transition hover:bg-[rgba(192,204,202,0.09)] ${
        active ? "bg-[rgba(111,191,178,0.14)]" : ""
      }`}
    >
      <span className="flex flex-wrap items-baseline gap-x-2">
        <span className="font-mono text-[12px] text-[#dfe6e4]">{model.id}</span>
        {active && (
          <span className="font-mono text-[9px] uppercase tracking-wider text-accent">activo</span>
        )}
      </span>
      <span className="mt-0.5 block font-mono text-[10px] text-[#5e7370]">
        {[price(model), ctx(model)].filter(Boolean).join(" · ")}
      </span>
      {why && <span className="mt-1 block text-[11px] leading-snug text-[#8b9a97]">{why}</span>}
    </button>
  );
}
