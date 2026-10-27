-- CreateTable
CREATE TABLE "Invitacion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "nombre" TEXT NOT NULL DEFAULT '',
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "tokenHash" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "aceptadaAt" DATETIME,
    "revocadaAt" DATETIME,
    "invitadoPorId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Invitacion_invitadoPorId_fkey" FOREIGN KEY ("invitadoPorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TokenCuenta" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "usadoAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TokenCuenta_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "openrouterKey" TEXT NOT NULL DEFAULT '',
    "openrouterHint" TEXT NOT NULL DEFAULT '',
    "usaClaveInstancia" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "emailVerificadoAt" DATETIME,
    "cargo" TEXT NOT NULL DEFAULT '',
    "formacion" TEXT NOT NULL DEFAULT '',
    "foto" TEXT NOT NULL DEFAULT '',
    "intentosFallidos" INTEGER NOT NULL DEFAULT 0,
    "bloqueadoHasta" DATETIME,
    "ultimoIngreso" DATETIME,
    "claveCambiadaAt" DATETIME
);
INSERT INTO "new_User" ("active", "createdAt", "email", "id", "name", "openrouterHint", "openrouterKey", "passwordHash", "role", "updatedAt", "usaClaveInstancia") SELECT "active", "createdAt", "email", "id", "name", "openrouterHint", "openrouterKey", "passwordHash", "role", "updatedAt", "usaClaveInstancia" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Invitacion_tokenHash_key" ON "Invitacion"("tokenHash");

-- CreateIndex
CREATE INDEX "Invitacion_email_idx" ON "Invitacion"("email");

-- CreateIndex
CREATE UNIQUE INDEX "TokenCuenta_tokenHash_key" ON "TokenCuenta"("tokenHash");

-- CreateIndex
CREATE INDEX "TokenCuenta_userId_tipo_idx" ON "TokenCuenta"("userId", "tipo");

-- Las cuentas que ya existían quedan verificadas: entraron cuando el administrador les dio acceso.
UPDATE "User" SET "emailVerificadoAt" = CURRENT_TIMESTAMP WHERE "emailVerificadoAt" IS NULL;
