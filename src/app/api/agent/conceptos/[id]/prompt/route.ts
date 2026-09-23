import { withToken } from "@/lib/agentRoute";
import { promptForConcept } from "@/lib/agentArtifacts";

/** GET /api/agent/conceptos/[id]/prompt?formato=BROCHURE|PROTOCEPTO|MOCKUP — prompt para producir el artefacto. */
export const GET = withToken(async (user, _identity, request) => {
  const url = new URL(request.url);
  const parts = url.pathname.split("/");
  const id = decodeURIComponent(parts[parts.length - 2]);
  return promptForConcept(user, id, url.searchParams.get("formato") ?? "BROCHURE");
});
