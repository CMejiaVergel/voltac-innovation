"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { authenticate, createSession, destroySession, pruneExpiredSessions } from "@/lib/auth";
import { ipCliente, permitir } from "@/lib/seguridad";

export type LoginState = { error: string | null };

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Ingresa tu correo y tu contraseña." };
  }

  // Límite por conexión: frena a quien prueba contraseñas en ráfaga, aunque
  // vaya cambiando de correo.
  const ip = await ipCliente();
  if (!permitir(`login:${ip}`, 10, 10 * 60_000)) {
    return { error: "Demasiados intentos desde esta conexión. Espera unos minutos e inténtalo de nuevo." };
  }

  const r = await authenticate(email, password);
  if (!r.ok) {
    if (r.motivo === "SIN_ACTIVAR") return { error: "Tu cuenta todavía no está activa: abre el enlace de activación que te llegó al correo." };
    // Mensaje unico a proposito: no se revela si el correo existe ni si la cuenta se bloqueó.
    return { error: "Correo o contraseña incorrectos. Tras varios intentos fallidos la cuenta se bloquea 15 minutos." };
  }
  const userId = r.userId;

  const h = await headers();
  await createSession(userId, h.get("user-agent") ?? undefined);
  await pruneExpiredSessions();

  redirect("/proyectos");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}
