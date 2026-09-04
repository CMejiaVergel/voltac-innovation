import "server-only";

import { prisma } from "@/lib/db";
import { descifrar } from "@/lib/secretos";
import { claveDeInstancia, OpenRouterNotConfigured } from "@/lib/agent/openrouter";

/**
 * Con que clave corre el agente para una persona concreta.
 *
 * El orden importa y no es arbitrario:
 *
 *   1. Su clave propia, si la puso. Siempre gana, incluso teniendo permiso
 *      sobre la del servidor: si alguien se molesto en poner la suya, es que
 *      quiere gastar la suya.
 *   2. La del servidor, SOLO si tiene el permiso explicito. Es la cuenta de
 *      quien monto la instancia y son sus creditos.
 *   3. Nada, y el agente no corre.
 *
 * Antes no habia paso 2 ni 3: cualquier miembro del equipo gastaba la cuenta
 * de una sola persona sin enterarse.
 */
export async function claveDelAgente(userId: string): Promise<{
  clave: string;
  origen: "PROPIA" | "INSTANCIA";
}> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { openrouterKey: true, usaClaveInstancia: true },
  });
  if (!user) throw new OpenRouterNotConfigured("No se encontro el usuario.");

  const propia = descifrar(user.openrouterKey);
  if (propia) return { clave: propia, origen: "PROPIA" };

  // Guardada pero ilegible: SESSION_SECRET cambio desde que se cifro. Hay que
  // decirlo, no tratarlo como "no tiene clave", o la persona no entendera por
  // que su clave guardada dejo de servir.
  if (user.openrouterKey) {
    throw new OpenRouterNotConfigured(
      "Tu clave guardada no se puede leer: el secreto del servidor cambio desde que la guardaste. Vuelve a introducirla en tu cuenta.",
    );
  }

  if (user.usaClaveInstancia) {
    const instancia = claveDeInstancia();
    if (instancia) return { clave: instancia, origen: "INSTANCIA" };
  }

  throw new OpenRouterNotConfigured(
    "No tienes una clave de OpenRouter configurada. Ponla en tu cuenta para usar el agente: cada quien gasta sus propios creditos.",
  );
}

/** Lo que la interfaz puede saber sin ver nunca la clave. */
export async function estadoClaveAgente(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { openrouterKey: true, openrouterHint: true, usaClaveInstancia: true },
  });
  if (!user) return null;

  const guardada = Boolean(user.openrouterKey);
  const legible = guardada && descifrar(user.openrouterKey) !== null;

  return {
    tieneClavePropia: guardada,
    /// Guardada pero ya no descifrable: hay que volver a introducirla.
    claveIlegible: guardada && !legible,
    pista: user.openrouterHint,
    puedeUsarInstancia: user.usaClaveInstancia,
    hayClaveDeInstancia: Boolean(claveDeInstancia()),
    /// Resumen de si el agente puede correr para esta persona.
    puedeCorrer: legible || (user.usaClaveInstancia && Boolean(claveDeInstancia())),
  };
}
