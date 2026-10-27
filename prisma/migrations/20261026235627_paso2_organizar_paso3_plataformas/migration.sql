-- CreateTable
CREATE TABLE "GrupoMapa" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mapId" TEXT NOT NULL,
    "rowId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "authorId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GrupoMapa_mapId_fkey" FOREIGN KEY ("mapId") REFERENCES "BomMap" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ElementoLente" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "colId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "detalle" TEXT NOT NULL DEFAULT '',
    "impacto" INTEGER,
    "incertidumbre" INTEGER,
    "eje" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "authorId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ElementoLente_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Plataforma" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "historia" TEXT NOT NULL DEFAULT '',
    "alcance" TEXT NOT NULL DEFAULT '',
    "seleccionada" BOOLEAN NOT NULL DEFAULT false,
    "priorizada" BOOLEAN NOT NULL DEFAULT false,
    "puntajes" TEXT NOT NULL DEFAULT '{}',
    "desarrollo" TEXT NOT NULL DEFAULT '{}',
    "position" INTEGER NOT NULL DEFAULT 0,
    "authorId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Plataforma_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlataformaFragmento" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "plataformaId" TEXT NOT NULL,
    "fragmentId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlataformaFragmento_plataformaId_fkey" FOREIGN KEY ("plataformaId") REFERENCES "Plataforma" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PlataformaFragmento_fragmentId_fkey" FOREIGN KEY ("fragmentId") REFERENCES "Fragment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Fragment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mapId" TEXT NOT NULL,
    "rowId" TEXT NOT NULL,
    "colId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "titulo" TEXT NOT NULL DEFAULT '',
    "position" INTEGER NOT NULL DEFAULT 0,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "items" TEXT NOT NULL DEFAULT '[]',
    "verification" TEXT NOT NULL DEFAULT 'TO_CONFIRM',
    "reviewState" TEXT NOT NULL DEFAULT 'ACCEPTED',
    "origin" TEXT NOT NULL DEFAULT 'HUMAN',
    "sourceUrl" TEXT,
    "sourceCitation" TEXT,
    "sourceId" TEXT,
    "agentRationale" TEXT,
    "authorId" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" DATETIME,
    "researchRunId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "grupoId" TEXT,
    "hotspot" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "Fragment_mapId_fkey" FOREIGN KEY ("mapId") REFERENCES "BomMap" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Fragment_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Fragment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Fragment_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Fragment_researchRunId_fkey" FOREIGN KEY ("researchRunId") REFERENCES "ResearchRun" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Fragment_grupoId_fkey" FOREIGN KEY ("grupoId") REFERENCES "GrupoMapa" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Fragment" ("agentRationale", "authorId", "colId", "createdAt", "hidden", "id", "items", "mapId", "origin", "position", "researchRunId", "reviewState", "reviewedAt", "reviewedById", "rowId", "sourceCitation", "sourceId", "sourceUrl", "text", "titulo", "updatedAt", "verification") SELECT "agentRationale", "authorId", "colId", "createdAt", "hidden", "id", "items", "mapId", "origin", "position", "researchRunId", "reviewState", "reviewedAt", "reviewedById", "rowId", "sourceCitation", "sourceId", "sourceUrl", "text", "titulo", "updatedAt", "verification" FROM "Fragment";
DROP TABLE "Fragment";
ALTER TABLE "new_Fragment" RENAME TO "Fragment";
CREATE INDEX "Fragment_mapId_rowId_colId_idx" ON "Fragment"("mapId", "rowId", "colId");
CREATE INDEX "Fragment_mapId_reviewState_idx" ON "Fragment"("mapId", "reviewState");
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
    "criteriosPlataforma" TEXT NOT NULL DEFAULT '[]',
    CONSTRAINT "Project_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Project_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "Organizacion" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Project" ("agentModel", "agentWebSearch", "company", "createdAt", "createdById", "id", "name", "organizacionId", "program", "slug", "status", "trashedAt", "updatedAt") SELECT "agentModel", "agentWebSearch", "company", "createdAt", "createdById", "id", "name", "organizacionId", "program", "slug", "status", "trashedAt", "updatedAt" FROM "Project";
DROP TABLE "Project";
ALTER TABLE "new_Project" RENAME TO "Project";
CREATE UNIQUE INDEX "Project_slug_key" ON "Project"("slug");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "GrupoMapa_mapId_rowId_idx" ON "GrupoMapa"("mapId", "rowId");

-- CreateIndex
CREATE INDEX "ElementoLente_projectId_colId_idx" ON "ElementoLente"("projectId", "colId");

-- CreateIndex
CREATE INDEX "Plataforma_projectId_idx" ON "Plataforma"("projectId");

-- CreateIndex
CREATE INDEX "PlataformaFragmento_fragmentId_idx" ON "PlataformaFragmento"("fragmentId");

-- CreateIndex
CREATE UNIQUE INDEX "PlataformaFragmento_plataformaId_fragmentId_key" ON "PlataformaFragmento"("plataformaId", "fragmentId");
