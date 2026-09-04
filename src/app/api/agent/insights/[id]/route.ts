import { withToken, readJson } from "@/lib/agentRoute";
import { updateInsightById, deleteInsightById, type IncomingInsight } from "@/lib/agentInsights";

/**
 * PATCH /api/agent/insights/[id]  — corrige un insight
 * DELETE /api/agent/insights/[id] — lo elimina
 *
 * Los puntos y las ideas se reemplazan enteros cuando vienen en el cuerpo: es
 * mas honesto que fusionar a ciegas, porque rehacer el recorrido de un insight
 * casi nunca es añadir un punto suelto.
 */
function idDeLaUrl(request: Request) {
  const parts = new URL(request.url).pathname.split("/");
  return decodeURIComponent(parts[parts.length - 1]);
}

export const PATCH = withToken(
  async (user, _identity, request) => {
    const cambios = await readJson<Partial<IncomingInsight> & { estado?: string }>(request);
    return updateInsightById(user, idDeLaUrl(request), cambios);
  },
  { write: true },
);

export const DELETE = withToken(
  async (user, _identity, request) => deleteInsightById(user, idDeLaUrl(request)),
  { write: true },
);
