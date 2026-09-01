import { withToken } from "@/lib/agentRoute";
import { listProjects } from "@/lib/agentApi";

/** GET /api/agent/proyectos — proyectos visibles para el token. */
export const GET = withToken(async (user) => ({ proyectos: await listProjects(user) }));
