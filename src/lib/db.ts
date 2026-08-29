import { PrismaClient } from "@prisma/client";

/**
 * Singleton de Prisma. En desarrollo Next recarga los modulos en cada cambio,
 * asi que sin esto se abren decenas de conexiones a SQLite hasta que el
 * proceso las agota.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
