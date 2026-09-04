import { withToken } from "@/lib/agentRoute";
import { projectDigest } from "@/lib/agentApi";

/**
 * GET /api/agent/proyectos/[slug]/estado
 *
 * La lectura barata: conteos, celdas flacas y una firma del estado. Sirve para
 * decidir si hace falta traerse el proyecto entero o si el contexto que ya se
 * tenia sigue valiendo.
 */
export const GET = withToken(async (user, _identity, request) => {
  const parts = new URL(request.url).pathname.split("/");
  const slug = decodeURIComponent(parts[parts.length - 2]);
  return projectDigest(user, slug);
});
