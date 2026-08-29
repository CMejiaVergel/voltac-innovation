import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth";
import { listModels } from "@/lib/agent/openrouter";

/**
 * Catalogo de modelos de OpenRouter para el selector.
 *
 * Se sirve desde el servidor y no desde el navegador para no exponer la clave
 * de OpenRouter al cliente. El catalogo se cachea una hora en memoria.
 */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "No autenticado." }, { status: 401 });

  try {
    const models = await listModels();
    return NextResponse.json({ models });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "No se pudo leer el catalogo." },
      { status: 502 },
    );
  }
}
