import { withToken, readJson } from "@/lib/agentRoute";
import { listProjects, createProjectForAgent, type NuevoProyecto } from "@/lib/agentApi";

/** GET /api/agent/proyectos — proyectos visibles para el token. */
export const GET = withToken(async (user) => ({ proyectos: await listProjects(user) }));

/**
 * POST /api/agent/proyectos — abre un proyecto nuevo.
 *
 * Quien lo crea queda como OWNER. El mapa nace vacio y el brief solo con el
 * reto literal: la etapa Configurar es trabajo del equipo con la empresa
 * delante, y adelantarla desde aqui inventaria restricciones que nadie fijo.
 */
export const POST = withToken(
  async (user, _identity, request) =>
    createProjectForAgent(user, await readJson<NuevoProyecto>(request)),
  { write: true },
);
