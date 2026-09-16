import { withToken, readJson } from "@/lib/agentRoute";
import { createConcepts, type IncomingConcept } from "@/lib/agentConcepts";

type Cuerpo = { conceptos?: IncomingConcept[]; estado?: "PROPOSED" | "ACCEPTED" };

/**
 * POST /api/agent/proyectos/[slug]/conceptos
 *
 * Crea conceptos de solucion de la etapa Convergir a partir de ideas de
 * Combinar. Un concepto que cite ideas de otro proyecto se rechaza entero y el
 * motivo vuelve en la respuesta.
 */
export const POST = withToken(
  async (user, _identity, request) => {
    const parts = new URL(request.url).pathname.split("/");
    const slug = decodeURIComponent(parts[parts.length - 2]);
    const body = await readJson<Cuerpo>(request);
    return createConcepts(user, slug, body.conceptos ?? [], body.estado ?? "PROPOSED");
  },
  { write: true },
);
