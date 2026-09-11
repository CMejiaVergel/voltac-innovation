import { withToken, readJson } from "@/lib/agentRoute";
import { renameProject } from "@/lib/agentApi";

type Cuerpo = { nombre?: string; empresa?: string; programa?: string };

/**
 * POST /api/agent/proyectos/[slug]/renombrar
 *
 * Cambia como se llama el proyecto, no donde vive: el slug se conserva a
 * proposito para que no se rompan los enlaces guardados ni los respaldos.
 */
export const POST = withToken(
  async (user, _identity, request) => {
    const partes = new URL(request.url).pathname.split("/");
    const slug = decodeURIComponent(partes[partes.length - 2]);
    return renameProject(user, slug, await readJson<Cuerpo>(request));
  },
  { write: true },
);
