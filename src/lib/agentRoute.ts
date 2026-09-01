import "server-only";

import { NextResponse } from "next/server";

import { identifyRequest, type TokenIdentity } from "@/lib/apiToken";
import { AgentApiError } from "@/lib/agentApi";
import type { SessionUser } from "@/lib/auth";

/**
 * Envoltorio comun de las rutas /api/agent.
 *
 * Resuelve el token, aplica el modo de solo lectura y traduce los errores del
 * dominio a codigos HTTP. Asi cada ruta solo contiene su operacion.
 */
export function withToken(
  handler: (user: SessionUser, identity: TokenIdentity, request: Request) => Promise<unknown>,
  opts: { write?: boolean } = {},
) {
  return async (request: Request) => {
    const identity = await identifyRequest(request);
    if (!identity) {
      return NextResponse.json(
        { error: "Token ausente o invalido. Usa la cabecera Authorization: Bearer <token>." },
        { status: 401 },
      );
    }
    if (opts.write && identity.readOnly) {
      return NextResponse.json({ error: "El token es de solo lectura." }, { status: 403 });
    }

    try {
      const data = await handler(identity.user, identity, request);
      return NextResponse.json(data ?? { ok: true });
    } catch (e) {
      if (e instanceof AgentApiError) {
        return NextResponse.json({ error: e.message }, { status: e.status });
      }
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Error inesperado." },
        { status: 500 },
      );
    }
  };
}

/** Lee el cuerpo JSON de la peticion, con error claro si viene mal. */
export async function readJson<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new AgentApiError("El cuerpo de la peticion no es JSON valido.", 400);
  }
}
