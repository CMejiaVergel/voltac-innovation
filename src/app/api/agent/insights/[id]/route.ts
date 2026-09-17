import { withToken, readJson } from "@/lib/agentRoute";
import { updateInsightById, deleteInsightById, type InsightPatch } from "@/lib/agentInsights";

/**
 * PATCH /api/agent/insights/[id]  — corrige un insight
 * DELETE /api/agent/insights/[id] — lo elimina
 *
 * Los puntos se reemplazan enteros cuando vienen en el cuerpo: rehacer el
 * recorrido de un insight casi nunca es añadir un punto suelto. Las ideas no:
 * las que traen id se editan en su sitio, porque los conceptos de Convergir
 * apuntan a ellas.
 */
function idDeLaUrl(request: Request) {
  const parts = new URL(request.url).pathname.split("/");
  return decodeURIComponent(parts[parts.length - 1]);
}

export const PATCH = withToken(
  async (user, _identity, request) => {
    const cambios = await readJson<InsightPatch>(request);
    return updateInsightById(user, idDeLaUrl(request), cambios);
  },
  { write: true },
);

export const DELETE = withToken(
  async (user, _identity, request) => deleteInsightById(user, idDeLaUrl(request)),
  { write: true },
);
