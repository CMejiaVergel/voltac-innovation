import { withToken, readJson } from "@/lib/agentRoute";
import { updateBriefFields, type BriefPatch } from "@/lib/agentApi";

/**
 * PATCH /api/agent/proyectos/[slug]/brief
 *
 * Parche parcial de la etapa Configurar. Solo se escriben los campos que
 * vienen en el cuerpo: corregir el reto no debe borrar la meta.
 */
export const PATCH = withToken(
  async (user, _identity, request) => {
    const parts = new URL(request.url).pathname.split("/");
    const slug = decodeURIComponent(parts[parts.length - 2]);
    return updateBriefFields(user, slug, await readJson<BriefPatch>(request));
  },
  { write: true },
);
