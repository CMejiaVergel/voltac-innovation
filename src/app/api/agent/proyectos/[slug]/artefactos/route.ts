import { withToken, readJson } from "@/lib/agentRoute";
import { createArtifactForAgent, type IncomingArtifact } from "@/lib/agentArtifacts";

/**
 * POST /api/agent/proyectos/[slug]/artefactos
 *
 * Crea un artefacto de innovacion sobre un concepto: los supuestos que expone
 * y las cifras que muestra, cada una declarada. El documento se carga aparte.
 */
export const POST = withToken(
  async (user, _identity, request) => {
    const parts = new URL(request.url).pathname.split("/");
    const slug = decodeURIComponent(parts[parts.length - 2]);
    return createArtifactForAgent(user, slug, await readJson<IncomingArtifact>(request));
  },
  { write: true },
);
