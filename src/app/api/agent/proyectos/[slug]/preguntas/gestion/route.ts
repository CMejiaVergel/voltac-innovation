import { withToken, readJson } from "@/lib/agentRoute";
import { updateQuestions, deleteQuestions, orderQuestions } from "@/lib/agentApi";

type Cuerpo = {
  editar?: Array<{
    id: string;
    texto?: string;
    resuelve?: string;
    estado?: string;
    respuesta?: string;
  }>;
  eliminar?: string[];
  orden?: string[];
};

/**
 * POST /api/agent/proyectos/[slug]/preguntas/gestion
 *
 * Curar el banco en una sola llamada: editar, eliminar y reordenar. Van juntas
 * porque limpiar duplicados casi siempre implica las tres cosas a la vez.
 */
export const POST = withToken(
  async (user, _identity, request) => {
    const parts = new URL(request.url).pathname.split("/");
    const slug = decodeURIComponent(parts[parts.length - 3]);
    const body = await readJson<Cuerpo>(request);

    const resultado: Record<string, unknown> = {};
    if (body.editar?.length) {
      Object.assign(resultado, await updateQuestions(user, slug, body.editar));
    }
    if (body.eliminar?.length) {
      Object.assign(resultado, await deleteQuestions(user, slug, body.eliminar));
    }
    if (body.orden?.length) {
      Object.assign(resultado, await orderQuestions(user, slug, body.orden));
    }
    return resultado;
  },
  { write: true },
);
