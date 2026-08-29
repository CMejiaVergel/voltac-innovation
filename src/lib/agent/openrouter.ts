import "server-only";

/**
 * Cliente de OpenRouter.
 *
 * OpenRouter expone una API compatible con la de OpenAI, asi que basta `fetch`
 * y no hace falta ningun SDK. A cambio da acceso a cientos de modelos con una
 * sola clave y una sola factura, y permite cambiar de modelo sin tocar codigo.
 *
 * Busqueda web: OpenRouter la ofrece como un *plugin* que funciona con
 * cualquier modelo, incluso con los que no la traen de fabrica. Se cobra por
 * resultado devuelto, aparte de los tokens. Por eso es apagable por proyecto:
 * es la parte cara de una corrida.
 */

const BASE = "https://openrouter.ai/api/v1";

export const DEFAULT_MODEL = "google/gemini-2.5-flash";

export function openRouterIsConfigured(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY);
}

export class OpenRouterNotConfigured extends Error {
  constructor() {
    super("Falta OPENROUTER_API_KEY en el entorno. El agente no puede correr.");
    this.name = "OpenRouterNotConfigured";
  }
}

function headers(): Record<string, string> {
  const h: Record<string, string> = {
    Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
    "Content-Type": "application/json",
  };
  // OpenRouter usa estas dos para atribuir el trafico. Son opcionales.
  if (process.env.OPENROUTER_SITE_URL) h["HTTP-Referer"] = process.env.OPENROUTER_SITE_URL;
  h["X-Title"] = process.env.OPENROUTER_APP_NAME ?? "Voltac Innovacion";
  return h;
}

// ─────────────────────────────────────────────────────────────────────────────
// Catalogo de modelos
// ─────────────────────────────────────────────────────────────────────────────

export type CatalogModel = {
  id: string;
  name: string;
  contextLength: number;
  /** USD por millon de tokens de entrada. null si el precio no es numerico. */
  promptPerM: number | null;
  /** USD por millon de tokens de salida. */
  completionPerM: number | null;
  description: string;
};

type RawModel = {
  id: string;
  name?: string;
  description?: string;
  context_length?: number;
  pricing?: { prompt?: string; completion?: string };
};

let cache: { at: number; models: CatalogModel[] } | null = null;
const CACHE_MS = 60 * 60 * 1000;

function perMillion(raw: string | undefined): number | null {
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return n * 1_000_000; // OpenRouter publica el precio por token
}

/**
 * Catalogo vivo de OpenRouter. Se cachea una hora: los precios y el inventario
 * cambian, y no tiene sentido pedirlo en cada pulsacion del buscador.
 */
export async function listModels(force = false): Promise<CatalogModel[]> {
  if (!force && cache && Date.now() - cache.at < CACHE_MS) return cache.models;

  const res = await fetch(`${BASE}/models`, {
    headers: openRouterIsConfigured() ? headers() : { "Content-Type": "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`OpenRouter devolvio ${res.status} al pedir el catalogo de modelos.`);
  }

  const body = (await res.json()) as { data: RawModel[] };
  const models: CatalogModel[] = body.data
    .map((m) => ({
      id: m.id,
      name: m.name ?? m.id,
      contextLength: m.context_length ?? 0,
      promptPerM: perMillion(m.pricing?.prompt),
      completionPerM: perMillion(m.pricing?.completion),
      description: (m.description ?? "").slice(0, 300),
    }))
    .sort((a, b) => a.id.localeCompare(b.id));

  cache = { at: Date.now(), models };
  return models;
}

// ─────────────────────────────────────────────────────────────────────────────
// Completado
// ─────────────────────────────────────────────────────────────────────────────

export type ChatResult = {
  text: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  /** Resultados de busqueda web que cobro el plugin, si se uso. */
  webResults: number;
  /** Coste real de la peticion en USD, tal como lo reporta OpenRouter. */
  costUsd: number | null;
};

export async function chat(params: {
  model: string;
  system: string;
  user: string;
  maxTokens?: number;
  webSearch: boolean;
  maxWebResults?: number;
  signal?: AbortSignal;
}): Promise<ChatResult> {
  if (!openRouterIsConfigured()) throw new OpenRouterNotConfigured();

  const body: Record<string, unknown> = {
    model: params.model,
    messages: [
      { role: "system", content: params.system },
      { role: "user", content: params.user },
    ],
    max_tokens: params.maxTokens ?? 8000,
    temperature: 0.4,
    // Pide a OpenRouter que devuelva el coste real de la corrida.
    usage: { include: true },
  };

  if (params.webSearch) {
    body.plugins = [{ id: "web", max_results: params.maxWebResults ?? 8 }];
  }

  const res = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
    signal: params.signal,
  });

  const raw = await res.text();
  if (!res.ok) {
    throw new Error(`OpenRouter ${res.status}: ${raw.slice(0, 500)}`);
  }

  let data: {
    choices?: Array<{ message?: { content?: string } }>;
    model?: string;
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      cost?: number;
      num_search_results?: number;
    };
    error?: { message?: string };
  };
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error(`OpenRouter devolvio algo que no es JSON: ${raw.slice(0, 300)}`);
  }

  if (data.error) throw new Error(`OpenRouter: ${data.error.message ?? "error sin mensaje"}`);

  const text = data.choices?.[0]?.message?.content ?? "";
  if (!text.trim()) {
    throw new Error("El modelo devolvio una respuesta vacia. Prueba con otro modelo.");
  }

  return {
    text,
    model: data.model ?? params.model,
    inputTokens: data.usage?.prompt_tokens ?? 0,
    outputTokens: data.usage?.completion_tokens ?? 0,
    webResults: data.usage?.num_search_results ?? 0,
    costUsd: typeof data.usage?.cost === "number" ? data.usage.cost : null,
  };
}
