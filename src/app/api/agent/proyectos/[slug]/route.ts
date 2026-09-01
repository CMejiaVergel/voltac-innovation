import { withToken } from "@/lib/agentRoute";
import { getProjectContext } from "@/lib/agentApi";

/**
 * GET /api/agent/proyectos/[slug]
 *
 * Todo el contexto que un agente necesita antes de proponer: reto, brief,
 * plantilla con las reglas de cada columna, conteo por celda y los fragmentos
 * que ya existen (para no repetirlos).
 */
export const GET = withToken(async (user, _identity, request) => {
  const slug = decodeURIComponent(new URL(request.url).pathname.split("/").pop()!);
  return getProjectContext(user, slug);
});
