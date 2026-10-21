-- CreateTable
CREATE TABLE "Organizacion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sector" TEXT NOT NULL DEFAULT '',
    "descripcion" TEXT NOT NULL DEFAULT '',
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Organizacion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OrgMembership" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizacionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'EDITOR',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrgMembership_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "Organizacion" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OrgMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PerfilInnovacion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizacionId" TEXT NOT NULL,
    "definicion" TEXT NOT NULL DEFAULT '',
    "tiposInnovacion" TEXT NOT NULL DEFAULT '[]',
    "dondeInnovar" TEXT NOT NULL DEFAULT '',
    "queNoEsInnovar" TEXT NOT NULL DEFAULT '',
    "razonesCambio" TEXT NOT NULL DEFAULT '[]',
    "argumentoCambio" TEXT NOT NULL DEFAULT '',
    "brechaCuanto" TEXT NOT NULL DEFAULT '',
    "brechaCuando" TEXT NOT NULL DEFAULT '',
    "objetivos" TEXT NOT NULL DEFAULT '[]',
    "metricas" TEXT NOT NULL DEFAULT '[]',
    "ejeGeografico" INTEGER NOT NULL DEFAULT 0,
    "ejeNovedad" INTEGER NOT NULL DEFAULT 0,
    "ejeNucleo" INTEGER NOT NULL DEFAULT 0,
    "ejeInversion" INTEGER NOT NULL DEFAULT 0,
    "presupuesto" TEXT NOT NULL DEFAULT '',
    "horizonte" TEXT NOT NULL DEFAULT '',
    "restricciones" TEXT NOT NULL DEFAULT '[]',
    "prospeccion" TEXT NOT NULL DEFAULT '',
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PerfilInnovacion_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "Organizacion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DesafioPropuesto" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizacionId" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "problema" TEXT NOT NULL DEFAULT '',
    "porQueRelevante" TEXT NOT NULL DEFAULT '',
    "impacto" TEXT NOT NULL DEFAULT '',
    "origen" TEXT NOT NULL DEFAULT 'EQUIPO',
    "trabajandoEn" INTEGER NOT NULL DEFAULT 0,
    "emocionante" INTEGER NOT NULL DEFAULT 0,
    "nivelImpacto" INTEGER NOT NULL DEFAULT 0,
    "encaje" TEXT NOT NULL DEFAULT '{}',
    "estado" TEXT NOT NULL DEFAULT 'PROPUESTO',
    "projectId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DesafioPropuesto_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "Organizacion" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DesafioPropuesto_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "DesafioPropuesto_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VotoDesafio" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "desafioId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "puntos" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VotoDesafio_desafioId_fkey" FOREIGN KEY ("desafioId") REFERENCES "DesafioPropuesto" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "VotoDesafio_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "company" TEXT,
    "program" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "trashedAt" DATETIME,
    "agentModel" TEXT NOT NULL DEFAULT '',
    "agentWebSearch" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "organizacionId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Project_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Project_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "Organizacion" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Project" ("agentModel", "agentWebSearch", "company", "createdAt", "createdById", "id", "name", "program", "slug", "status", "trashedAt", "updatedAt") SELECT "agentModel", "agentWebSearch", "company", "createdAt", "createdById", "id", "name", "program", "slug", "status", "trashedAt", "updatedAt" FROM "Project";
DROP TABLE "Project";
ALTER TABLE "new_Project" RENAME TO "Project";
CREATE UNIQUE INDEX "Project_slug_key" ON "Project"("slug");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Organizacion_slug_key" ON "Organizacion"("slug");

-- CreateIndex
CREATE INDEX "OrgMembership_userId_idx" ON "OrgMembership"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "OrgMembership_organizacionId_userId_key" ON "OrgMembership"("organizacionId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "PerfilInnovacion_organizacionId_key" ON "PerfilInnovacion"("organizacionId");

-- CreateIndex
CREATE UNIQUE INDEX "DesafioPropuesto_projectId_key" ON "DesafioPropuesto"("projectId");

-- CreateIndex
CREATE INDEX "DesafioPropuesto_organizacionId_idx" ON "DesafioPropuesto"("organizacionId");

-- CreateIndex
CREATE UNIQUE INDEX "VotoDesafio_desafioId_userId_key" ON "VotoDesafio"("desafioId", "userId");
