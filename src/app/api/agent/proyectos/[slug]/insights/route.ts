import { withToken, readJson } from "@/lib/agentRoute";
import { createInsights, orderInsights, type IncomingInsight } from "@/lib/agentInsights";

type Cuerpo = {
  insights?: IncomingInsight[];
  estado?: "PROPOSED" | "ACCEPTED";
  orden?: string[];
};

/**
 * POST /api/agent/proyectos/[slug]/insights
 *
 * Crea insights de la etapa Combinar, y opcionalmente fija el orden del
 * tablero. Un insight que cite puntos inexistentes se rechaza entero y el
 * motivo vuelve en la respuesta, para que el agente pueda corregirlo.
 */
export const POST = withToken(
  async (user, _identity, request) => {
    const parts = new URL(request.url).pathname.split("/");
    const slug = decodeURIComponent(parts[parts.length - 2]);
    const body = await readJson<Cuerpo>(request);

    const resultado: Record<string, unknown> = {};
    if (body.insights?.length) {
      Object.assign(
        resultado,
        await createInsights(user, slug, body.insights, body.estado ?? "PROPOSED"),
      );
    }
    if (body.orden?.length) {
      Object.assign(resultado, await orderInsights(user, slug, body.orden));
    }
    return resultado;
  },
  { write: true },
);
