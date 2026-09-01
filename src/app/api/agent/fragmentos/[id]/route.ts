import { withToken, readJson } from "@/lib/agentRoute";
import { updateFragment, deleteFragmentById } from "@/lib/agentApi";

function idFrom(request: Request): string {
  return decodeURIComponent(new URL(request.url).pathname.split("/").pop()!);
}

/** PATCH /api/agent/fragmentos/[id] — editar texto, celda, verificacion o estado. */
export const PATCH = withToken(
  async (user, _identity, request) => {
    const body = await readJson<Parameters<typeof updateFragment>[2]>(request);
    return updateFragment(user, idFrom(request), body);
  },
  { write: true },
);

/** DELETE /api/agent/fragmentos/[id] */
export const DELETE = withToken(
  async (user, _identity, request) => deleteFragmentById(user, idFrom(request)),
  { write: true },
);
