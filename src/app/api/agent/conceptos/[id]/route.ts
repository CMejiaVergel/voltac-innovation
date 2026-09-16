import { withToken, readJson } from "@/lib/agentRoute";
import { updateConceptById, type ConceptPatch } from "@/lib/agentConcepts";

/**
 * PATCH /api/agent/conceptos/[id] — corrige o puntua un concepto de Convergir.
 */
export const PATCH = withToken(
  async (user, _identity, request) => {
    const parts = new URL(request.url).pathname.split("/");
    const id = decodeURIComponent(parts[parts.length - 1]);
    return updateConceptById(user, id, await readJson<ConceptPatch>(request));
  },
  { write: true },
);
