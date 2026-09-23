import { withToken, readJson } from "@/lib/agentRoute";
import { uploadArtifactDocument } from "@/lib/agentArtifacts";

/** PUT /api/agent/artefactos/[id]/documento — carga el HTML del artefacto: { html }. */
export const PUT = withToken(
  async (user, _identity, request) => {
    const parts = new URL(request.url).pathname.split("/");
    const id = decodeURIComponent(parts[parts.length - 2]);
    const { html } = await readJson<{ html: string }>(request);
    return uploadArtifactDocument(user, id, html);
  },
  { write: true },
);
