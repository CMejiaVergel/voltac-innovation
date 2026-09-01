import { withToken, readJson } from "@/lib/agentRoute";
import { addQuestions } from "@/lib/agentApi";

/** POST /api/agent/proyectos/[slug]/preguntas — { preguntas: [{texto, paraQuien}] } */
export const POST = withToken(
  async (user, _identity, request) => {
    const parts = new URL(request.url).pathname.split("/");
    const slug = decodeURIComponent(parts[parts.length - 2]);
    const body = await readJson<{ preguntas: Array<{ texto: string; paraQuien?: string }> }>(
      request,
    );
    return addQuestions(user, slug, body.preguntas ?? []);
  },
  { write: true },
);
