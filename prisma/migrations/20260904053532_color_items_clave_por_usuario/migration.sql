-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Fragment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mapId" TEXT NOT NULL,
    "rowId" TEXT NOT NULL,
    "colId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
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
    CONSTRAINT "Fragment_mapId_fkey" FOREIGN KEY ("mapId") REFERENCES "BomMap" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Fragment_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Fragment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Fragment_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Fragment_researchRunId_fkey" FOREIGN KEY ("researchRunId") REFERENCES "ResearchRun" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Fragment" ("agentRationale", "authorId", "colId", "createdAt", "hidden", "id", "mapId", "origin", "position", "researchRunId", "reviewState", "reviewedAt", "reviewedById", "rowId", "sourceCitation", "sourceId", "sourceUrl", "text", "updatedAt", "verification") SELECT "agentRationale", "authorId", "colId", "createdAt", "hidden", "id", "mapId", "origin", "position", "researchRunId", "reviewState", "reviewedAt", "reviewedById", "rowId", "sourceCitation", "sourceId", "sourceUrl", "text", "updatedAt", "verification" FROM "Fragment";
DROP TABLE "Fragment";
ALTER TABLE "new_Fragment" RENAME TO "Fragment";
CREATE INDEX "Fragment_mapId_rowId_colId_idx" ON "Fragment"("mapId", "rowId", "colId");
CREATE INDEX "Fragment_mapId_reviewState_idx" ON "Fragment"("mapId", "reviewState");
CREATE TABLE "new_Insight" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "tag" TEXT NOT NULL DEFAULT '',
    "color" TEXT NOT NULL DEFAULT '',
    "statement" TEXT NOT NULL,
    "fact" TEXT NOT NULL DEFAULT '',
    "counterpart" TEXT NOT NULL DEFAULT '',
    "shift" TEXT NOT NULL DEFAULT '',
    "offerWho" TEXT NOT NULL DEFAULT '',
    "offerProof" TEXT NOT NULL DEFAULT '',
    "payWho" TEXT NOT NULL DEFAULT '',
    "payProof" TEXT NOT NULL DEFAULT '',
    "business" TEXT NOT NULL DEFAULT '',
    "limitNote" TEXT NOT NULL DEFAULT '',
    "reviewState" TEXT NOT NULL DEFAULT 'ACCEPTED',
    "origin" TEXT NOT NULL DEFAULT 'HUMAN',
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "authorId" TEXT,
    "researchRunId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "sourceId" TEXT,
    CONSTRAINT "Insight_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Insight_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Insight_researchRunId_fkey" FOREIGN KEY ("researchRunId") REFERENCES "ResearchRun" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Insight_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Insight" ("authorId", "business", "counterpart", "createdAt", "fact", "hidden", "id", "limitNote", "offerProof", "offerWho", "origin", "payProof", "payWho", "position", "projectId", "researchRunId", "reviewState", "shift", "sourceId", "statement", "tag", "updatedAt") SELECT "authorId", "business", "counterpart", "createdAt", "fact", "hidden", "id", "limitNote", "offerProof", "offerWho", "origin", "payProof", "payWho", "position", "projectId", "researchRunId", "reviewState", "shift", "sourceId", "statement", "tag", "updatedAt" FROM "Insight";
DROP TABLE "Insight";
ALTER TABLE "new_Insight" RENAME TO "Insight";
CREATE INDEX "Insight_projectId_reviewState_idx" ON "Insight"("projectId", "reviewState");
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
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_User" ("active", "createdAt", "email", "id", "name", "passwordHash", "role", "updatedAt") SELECT "active", "createdAt", "email", "id", "name", "passwordHash", "role", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- Quien ya administraba la instancia conserva el permiso de usar la clave
-- del servidor: es su cuenta de OpenRouter y su .env. Todos los demas
-- entran sin permiso y tendran que poner la suya, que es el objetivo.
UPDATE "User" SET "usaClaveInstancia" = 1 WHERE "role" = 'ADMIN';
