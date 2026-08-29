import "server-only";

import Anthropic from "@anthropic-ai/sdk";

import { prisma } from "@/lib/db";
import { parseShape, isValidCoord } from "@/lib/templates";
import { buildSystemPrompt, buildUserPrompt, type AgentScope } from "@/lib/agent/prompt";
import { parseAgentOutput, type AgentFragment } from "@/lib/agent/schema";

/**
 * Ejecucion del agente investigador.
 *
 * Una corrida puede tardar varios minutos porque el modelo busca en la web. Por
 * eso `startResearchRun` crea la fila y devuelve de inmediato: el trabajo sigue
 * en segundo plano y la UI consulta el estado. Asi ninguna peticion HTTP queda
 * abierta esperando, ni el proxy la corta a mitad.
 *
 * Nada de lo que produce el agente entra al mapa directamente: todo aterriza
 * como PROPOSED y espera revision humana.
 */

const STALE_AFTER_MS = 25 * 60 * 1000;

export class AgentNotConfigured extends Error {
  constructor() {
    super("Falta ANTHROPIC_API_KEY en el entorno. El agente no puede correr.");
    this.name = "AgentNotConfigured";
  }
}

export function agentIsConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/** Crea la corrida y la lanza. Devuelve el id para que la UI haga seguimiento. */
export async function startResearchRun(params: {
  projectId: string;
  mapId: string;
  userId: string;
  scope: AgentScope;
}): Promise<string> {
  if (!agentIsConfigured()) throw new AgentNotConfigured();

  const run = await prisma.researchRun.create({
    data: {
      projectId: params.projectId,
      mapId: params.mapId,
      requestedById: params.userId,
      status: "RUNNING",
      scope: JSON.stringify(params.scope),
      model: process.env.ANTHROPIC_MODEL ?? "claude-opus-5",
    },
  });

  // Deliberadamente sin await: la corrida vive mas que la peticion.
  void executeRun(run.id).catch(async (e: unknown) => {
    await prisma.researchRun.update({
      where: { id: run.id },
      data: {
        status: "ERROR",
        error: e instanceof Error ? e.message : String(e),
        finishedAt: new Date(),
      },
    });
  });

  return run.id;
}

// ─────────────────────────────────────────────────────────────────────────────

async function executeRun(runId: string): Promise<void> {
  const run = await prisma.researchRun.findUniqueOrThrow({
    where: { id: runId },
    include: {
      project: { include: { brief: true } },
      map: { include: { template: true } },
    },
  });

  const shape = parseShape(run.map.template.rows, run.map.template.cols);
  const scope = JSON.parse(run.scope) as AgentScope;

  const existing = await prisma.fragment.findMany({
    where: { mapId: run.mapId, reviewState: "ACCEPTED" },
    select: { rowId: true, colId: true, text: true },
    orderBy: [{ rowId: "asc" }, { colId: "asc" }, { position: "asc" }],
  });

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const model = process.env.ANTHROPIC_MODEL ?? "claude-opus-5";
  const maxSearches = Number(process.env.AGENT_MAX_WEB_SEARCHES ?? 12);

  const stream = client.messages.stream({
    model,
    max_tokens: 16000,
    system: buildSystemPrompt(shape),
    tools: [
      {
        type: "web_search_20250305",
        name: "web_search",
        max_uses: Number.isFinite(maxSearches) ? maxSearches : 12,
      } as Anthropic.Messages.ToolUnion,
    ],
    messages: [
      {
        role: "user",
        content: buildUserPrompt(run.project, run.project.brief, shape, scope, existing),
      },
    ],
  });

  const message = await stream.finalMessage();

  const text = message.content
    .filter((b): b is Anthropic.Messages.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");

  const usage = message.usage as Anthropic.Messages.Usage & {
    server_tool_use?: { web_search_requests?: number };
  };

  const parsed = parseAgentOutput(text);

  if (!parsed.ok) {
    await prisma.researchRun.update({
      where: { id: runId },
      data: {
        status: "ERROR",
        error: parsed.error,
        rawResponse: text,
        inputTokens: usage.input_tokens ?? 0,
        outputTokens: usage.output_tokens ?? 0,
        webSearches: usage.server_tool_use?.web_search_requests ?? 0,
        finishedAt: new Date(),
      },
    });
    return;
  }

  // ── Persistencia de lo propuesto ──────────────────────────────────────────

  const seen = new Set(existing.map((f) => normalize(f.text)));
  let accepted = 0;
  let discarded = 0;

  // El orden dentro de cada celda continua despues de lo que ya hay.
  const nextPosition = new Map<string, number>();
  for (const f of existing) {
    const k = `${f.rowId}|${f.colId}`;
    nextPosition.set(k, (nextPosition.get(k) ?? -1) + 1);
  }

  for (const frag of parsed.data.fragmentos) {
    if (!isValidCoord(shape, frag.fila, frag.columna)) {
      discarded++;
      continue;
    }
    const key = normalize(frag.texto);
    if (seen.has(key)) {
      discarded++;
      continue;
    }
    seen.add(key);

    const cell = `${frag.fila}|${frag.columna}`;
    const position = (nextPosition.get(cell) ?? -1) + 1;
    nextPosition.set(cell, position);

    const sourceId = await resolveSource(run.projectId, frag);

    const created = await prisma.fragment.create({
      data: {
        mapId: run.mapId,
        rowId: frag.fila,
        colId: frag.columna,
        text: frag.texto.trim(),
        position,
        // Si dice VERIFIED pero no trae URL, se degrada. La disciplina de
        // verificacion la impone el codigo, no la buena voluntad del modelo.
        verification:
          frag.verificacion === "VERIFIED" && !frag.fuenteUrl
            ? "TO_CONFIRM"
            : frag.verificacion,
        reviewState: "PROPOSED",
        origin: "AGENT",
        sourceUrl: frag.fuenteUrl ?? null,
        sourceCitation: frag.fuenteCita ?? null,
        sourceId,
        agentRationale: frag.porQueAqui ?? null,
        researchRunId: runId,
      },
    });

    await prisma.fragmentRevision.create({
      data: {
        mapId: run.mapId,
        fragmentId: created.id,
        action: "CREATE",
        text: created.text,
        rowId: created.rowId,
        colId: created.colId,
        verification: created.verification,
        reviewState: "PROPOSED",
        note: "Propuesto por el agente investigador",
      },
    });
    accepted++;
  }

  // ── Preguntas: lo que el agente no pudo verificar ─────────────────────────
  for (const q of parsed.data.preguntas) {
    const exists = await prisma.openQuestion.findFirst({
      where: { projectId: run.projectId, text: q.texto.trim() },
    });
    if (exists) continue;
    await prisma.openQuestion.create({
      data: {
        projectId: run.projectId,
        text: q.texto.trim(),
        askedTo: q.paraQuien ?? "",
        origin: "AGENT",
      },
    });
  }

  await prisma.researchRun.update({
    where: { id: runId },
    data: {
      status: "DONE",
      rawResponse: text,
      inputTokens: usage.input_tokens ?? 0,
      outputTokens: usage.output_tokens ?? 0,
      webSearches: usage.server_tool_use?.web_search_requests ?? 0,
      error:
        discarded > 0
          ? `${discarded} fragmento(s) descartados por celda invalida o duplicado. ${accepted} propuestos.`
          : null,
      finishedAt: new Date(),
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Reutiliza la fuente si ya esta en la bibliografia; si no, la agrega. */
async function resolveSource(
  projectId: string,
  frag: AgentFragment,
): Promise<string | null> {
  const url = frag.fuenteUrl?.trim();
  const title = frag.fuenteCita?.trim();
  if (!url && !title) return null;

  const found = url
    ? await prisma.source.findFirst({ where: { projectId, url } })
    : await prisma.source.findFirst({ where: { projectId, title: title! } });
  if (found) return found.id;

  const source = await prisma.source.create({
    data: {
      projectId,
      title: title || url || "Fuente sin titulo",
      url: url ?? null,
      addedBy: "AGENT",
    },
  });
  return source.id;
}

/**
 * Una corrida que quedo RUNNING mas alla del limite murio con el proceso.
 * Se marca para que la UI no muestre un spinner eterno.
 */
export async function reapStaleRuns(projectId: string): Promise<void> {
  await prisma.researchRun.updateMany({
    where: {
      projectId,
      status: "RUNNING",
      startedAt: { lt: new Date(Date.now() - STALE_AFTER_MS) },
    },
    data: {
      status: "ERROR",
      error: "La corrida se interrumpio (el servidor se reinicio o excedio el tiempo maximo).",
      finishedAt: new Date(),
    },
  });
}
