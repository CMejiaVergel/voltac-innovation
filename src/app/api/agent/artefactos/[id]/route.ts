import { withToken, readJson } from "@/lib/agentRoute";
import { updateArtifactForAgent } from "@/lib/agentArtifacts";

/** PATCH /api/agent/artefactos/[id] — corrige nombre, promesa, formato o estado. */
export const PATCH = withToken(
  async (user, _identity, request) => {
    const parts = new URL(request.url).pathname.split("/");
    const id = decodeURIComponent(parts[parts.length - 1]);
    return updateArtifactForAgent(user, id, await readJson(request));
  },
  { write: true },
);
