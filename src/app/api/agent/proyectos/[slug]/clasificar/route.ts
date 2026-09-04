import { withToken, readJson } from "@/lib/agentRoute";
import { classifyFragments } from "@/lib/agentApi";

type Cuerpo = { fragmentos?: { id: string; items: number[] }[] };

/**
 * POST /api/agent/proyectos/[slug]/clasificar
 *
 * Marca en lote a que items de su fila pertenece cada fragmento. Existe porque
 * hacerlo de uno en uno son cien llamadas para un mapa lleno. No toca el texto
 * ni la celda de nada.
 */
export const POST = withToken(
  async (user, _identity, request) => {
    const parts = new URL(request.url).pathname.split("/");
    const slug = decodeURIComponent(parts[parts.length - 2]);
    const body = await readJson<Cuerpo>(request);

    if (!body.fragmentos?.length) return { clasificados: 0, rechazados: [] };
    return classifyFragments(user, slug, body.fragmentos);
  },
  { write: true },
);
