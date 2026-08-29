"use server";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

/** Guarda la suscripcion push del navegador actual. */
export async function savePushSubscription(input: {
  endpoint: string;
  p256dh: string;
  auth: string;
  label: string;
}): Promise<void> {
  const user = await requireUser();

  await prisma.pushSubscription.upsert({
    where: { endpoint: input.endpoint },
    update: { userId: user.id, p256dh: input.p256dh, auth: input.auth, label: input.label },
    create: {
      userId: user.id,
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      auth: input.auth,
      label: input.label.slice(0, 120),
    },
  });
}

export async function removePushSubscription(endpoint: string): Promise<void> {
  await requireUser();
  await prisma.pushSubscription.deleteMany({ where: { endpoint } });
}
