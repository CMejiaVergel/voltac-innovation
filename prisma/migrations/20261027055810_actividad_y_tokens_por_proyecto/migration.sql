-- AlterTable
ALTER TABLE "User" ADD COLUMN "ultimaActividadAt" DATETIME;

-- CreateTable
CREATE TABLE "AccesoProyecto" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "etapa" TEXT NOT NULL DEFAULT '',
    "via" TEXT NOT NULL DEFAULT 'WEB',
    "desde" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hasta" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AccesoProyecto_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AccesoProyecto_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ApiToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tokenHash" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "readOnly" BOOLEAN NOT NULL DEFAULT false,
    "projectId" TEXT,
    "lastUsedAt" DATETIME,
    "expiresAt" DATETIME,
    "revokedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ApiToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ApiToken_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ApiToken" ("createdAt", "expiresAt", "id", "label", "lastUsedAt", "prefix", "readOnly", "revokedAt", "tokenHash", "userId") SELECT "createdAt", "expiresAt", "id", "label", "lastUsedAt", "prefix", "readOnly", "revokedAt", "tokenHash", "userId" FROM "ApiToken";
DROP TABLE "ApiToken";
ALTER TABLE "new_ApiToken" RENAME TO "ApiToken";
CREATE UNIQUE INDEX "ApiToken_tokenHash_key" ON "ApiToken"("tokenHash");
CREATE INDEX "ApiToken_userId_idx" ON "ApiToken"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "AccesoProyecto_userId_hasta_idx" ON "AccesoProyecto"("userId", "hasta");

-- CreateIndex
CREATE INDEX "AccesoProyecto_projectId_idx" ON "AccesoProyecto"("projectId");
