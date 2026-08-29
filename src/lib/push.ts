import "server-only";

import webpush from "web-push";

import { prisma } from "@/lib/db";

/**
 * Notificaciones push (Web Push / VAPID).
 *
 * El caso real que las justifica: una corrida del agente tarda minutos. Sin
 * aviso hay que quedarse mirando la pantalla o volver a entrar cada rato. Con
 * aviso, se lanza y se sigue con otra cosa.
 *
 * Generar el par de claves VAPID (una sola vez, se guardan en el .env):
 *   npx web-push generate-vapid-keys
 *
 * En iOS, Safari solo entrega push si la aplicacion se instalo en la pantalla
 * de inicio. En Android funciona tambien desde el navegador.
 */

export function pushIsConfigured(): boolean {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

export function publicKey(): string {
  return process.env.VAPID_PUBLIC_KEY ?? "";
}

function configure(): void {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? "mailto:contabilidadvoltac@gmail.com",
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
}

export type PushPayload = {
  title: string;
  body: string;
  /** Ruta a la que lleva el toque en la notificacion. */
  url: string;
  tag?: string;
};

/**
 * Envia a todos los dispositivos de un usuario.
 *
 * Las suscripciones caducan solas cuando el navegador se desinstala o el
 * usuario limpia sus datos: un 404 o 410 significa que ya no sirve y se borra.
 */
export async function notifyUser(userId: string, payload: PushPayload): Promise<number> {
  if (!pushIsConfigured()) return 0;
  configure();

  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  let sent = 0;

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        JSON.stringify(payload),
      );
      sent++;
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
      }
      // Un fallo de envio nunca debe tumbar la operacion que lo disparo.
    }
  }

  return sent;
}
