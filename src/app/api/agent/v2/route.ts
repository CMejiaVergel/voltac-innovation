import { NextResponse } from "next/server";

import { identifyRequest } from "@/lib/apiToken";
import { AgentApiError } from "@/lib/agentApi";
import { readJson } from "@/lib/agentRoute";
import { ejecutarV2, LECTURAS_V2 } from "@/lib/agentV2";

/**
 * POST /api/agent/v2 — canal no-code de la v2. Cuerpo: { accion, ...parámetros }.
 * Una sola ruta para todas las acciones: el servidor MCP solo traduce cada
 * herramienta a su acción, y las reglas viven en lib/agentV2.
 */
export async function POST(request: Request) {
  const identity = await identifyRequest(request);
  if (!identity) {
    return NextResponse.json({ error: "Token ausente o invalido. Usa la cabecera Authorization: Bearer <token>." }, { status: 401 });
  }
  try {
    const { accion, ...params } = await readJson<{ accion?: string } & Record<string, unknown>>(request);
    if (!accion) throw new AgentApiError("Falta la acción.", 400);
    if (identity.readOnly && !LECTURAS_V2.has(accion)) {
      return NextResponse.json({ error: "El token es de solo lectura." }, { status: 403 });
    }
    return NextResponse.json((await ejecutarV2(identity.user, accion, params)) ?? { ok: true });
  } catch (e) {
    if (e instanceof AgentApiError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error inesperado." }, { status: 500 });
  }
}
