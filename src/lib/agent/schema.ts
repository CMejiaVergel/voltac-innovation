import { z } from "zod";

/**
 * Contrato de salida del agente investigador.
 *
 * Todo lo que el agente propone pasa por aqui antes de tocar la base de datos.
 * Si el modelo devuelve algo que no cumple, la corrida falla de forma visible
 * en vez de escribir basura en el mapa.
 */

export const AgentFragmentSchema = z.object({
  /** id de fila de la plantilla (ej. "mercado") */
  fila: z.string().min(1),
  /** id de columna de la plantilla (ej. "adyac") */
  columna: z.string().min(1),
  /** La observacion cruda. Una sola idea. */
  texto: z.string().min(8).max(400),
  /** Indices de los items de la fila a los que pertenece. Se validan contra la
   *  plantilla al aplicar: un indice fuera de rango pintaria un punto de color
   *  que no corresponde a ninguna faceta. */
  items: z.array(z.number().int().min(0).max(9)).max(6).optional().default([]),
  verificacion: z.enum(["VERIFIED", "TO_CONFIRM", "ASSUMPTION"]),
  /** Obligatorio cuando verificacion es VERIFIED. */
  fuenteUrl: z.string().max(600).optional().nullable(),
  /** Titulo o cita corta de la fuente, para la bibliografia. */
  fuenteCita: z.string().max(300).optional().nullable(),
  /** Por que va en esa celda. Se muestra en la cola de revision, no en el mapa. */
  porQueAqui: z.string().max(400).optional().nullable(),
});

export const AgentQuestionSchema = z.object({
  texto: z.string().min(8).max(500),
  paraQuien: z.string().max(120).optional().nullable(),
});

export const AgentGapSchema = z.object({
  fila: z.string().min(1),
  columna: z.string().min(1),
  motivo: z.string().max(400),
});

export const AgentOutputSchema = z.object({
  fragmentos: z.array(AgentFragmentSchema).max(200),
  preguntas: z.array(AgentQuestionSchema).max(40).default([]),
  celdasSinCobertura: z.array(AgentGapSchema).max(60).default([]),
});

export type AgentFragment = z.infer<typeof AgentFragmentSchema>;
export type AgentOutput = z.infer<typeof AgentOutputSchema>;

/**
 * Extrae el bloque JSON final de la respuesta del modelo.
 *
 * El agente busca en la web antes de responder, asi que su texto trae
 * razonamiento y citas. El contrato es que termine con un unico bloque
 * ```json. Se toma el ultimo por si menciono JSON de ejemplo antes.
 */
export function extractJsonBlock(text: string): string | null {
  const fences = [...text.matchAll(/```(?:json)?\s*\n([\s\S]*?)```/g)];
  if (fences.length > 0) return fences[fences.length - 1][1].trim();

  // Sin cercas: intenta con el ultimo objeto de nivel superior.
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end > start) return text.slice(start, end + 1);

  return null;
}

export type ParseResult =
  | { ok: true; data: AgentOutput }
  | { ok: false; error: string };

export function parseAgentOutput(raw: string): ParseResult {
  const block = extractJsonBlock(raw);
  if (!block) {
    return { ok: false, error: "El agente no devolvio un bloque JSON reconocible." };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(block);
  } catch (e) {
    return {
      ok: false,
      error: `El bloque JSON del agente no es valido: ${(e as Error).message}`,
    };
  }

  const result = AgentOutputSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues
      .slice(0, 5)
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join(" | ");
    return { ok: false, error: `La salida del agente no cumple el contrato. ${issues}` };
  }

  return { ok: true, data: result.data };
}
