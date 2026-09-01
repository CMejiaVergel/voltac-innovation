import { withToken, readJson } from "@/lib/agentRoute";
import { createFragments, type IncomingFragment } from "@/lib/agentApi";

/**
 * POST /api/agent/proyectos/[slug]/fragmentos
 *
 * Cuerpo: { fragmentos: [...], estado?: "PROPOSED" | "ACCEPTED" }
 *
 * Por defecto entran como PROPOSED: el agente propone, una persona acepta.
 */
export const POST = withToken(
  async (user, _identity, request) => {
    const parts = new URL(request.url).pathname.split("/");
    const slug = decodeURIComponent(parts[parts.length - 2]);
    const body = await readJson<{
      fragmentos: IncomingFragment[];
      estado?: "PROPOSED" | "ACCEPTED";
    }>(request);
    return createFragments(user, slug, body.fragmentos ?? [], body.estado ?? "PROPOSED");
  },
  { write: true },
);
