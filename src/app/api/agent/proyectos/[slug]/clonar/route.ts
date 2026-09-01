import { withToken, readJson } from "@/lib/agentRoute";
import { cloneProject } from "@/lib/agentApi";

/**
 * POST /api/agent/proyectos/[slug]/clonar
 *
 * Cuerpo opcional: { sufijo?: string, incluirFragmentos?: boolean }
 */
export const POST = withToken(
  async (user, _identity, request) => {
    const parts = new URL(request.url).pathname.split("/");
    const slug = decodeURIComponent(parts[parts.length - 2]);
    const body = await readJson<{ sufijo?: string; incluirFragmentos?: boolean }>(
      request,
    ).catch(() => ({}) as { sufijo?: string; incluirFragmentos?: boolean });
    return cloneProject(user, slug, body);
  },
  { write: true },
);
