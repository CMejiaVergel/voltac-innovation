"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { authenticate, createSession, destroySession, pruneExpiredSessions } from "@/lib/auth";

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

  const userId = await authenticate(email, password);
  if (!userId) {
    // Mensaje unico a proposito: no se revela si el correo existe.
    return { error: "Correo o contraseña incorrectos." };
  }

  const h = await headers();
  await createSession(userId, h.get("user-agent") ?? undefined);
  await pruneExpiredSessions();

  redirect("/proyectos");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}
