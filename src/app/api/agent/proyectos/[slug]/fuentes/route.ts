import { withToken, readJson } from "@/lib/agentRoute";
import { addSources } from "@/lib/agentApi";

/** POST /api/agent/proyectos/[slug]/fuentes — { fuentes: [{titulo, url, editor, anio, nota}] } */
export const POST = withToken(
  async (user, _identity, request) => {
    const parts = new URL(request.url).pathname.split("/");
    const slug = decodeURIComponent(parts[parts.length - 2]);
    const body = await readJson<{
      fuentes: Array<{ titulo: string; url?: string; editor?: string; anio?: string; nota?: string }>;
    }>(request);
    return addSources(user, slug, body.fuentes ?? []);
  },
  { write: true },
);
