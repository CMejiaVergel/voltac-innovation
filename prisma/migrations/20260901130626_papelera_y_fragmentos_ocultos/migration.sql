-- AlterTable
ALTER TABLE "Project" ADD COLUMN "trashedAt" DATETIME;

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
INSERT INTO "new_Fragment" ("agentRationale", "authorId", "colId", "createdAt", "id", "mapId", "origin", "position", "researchRunId", "reviewState", "reviewedAt", "reviewedById", "rowId", "sourceCitation", "sourceId", "sourceUrl", "text", "updatedAt", "verification") SELECT "agentRationale", "authorId", "colId", "createdAt", "id", "mapId", "origin", "position", "researchRunId", "reviewState", "reviewedAt", "reviewedById", "rowId", "sourceCitation", "sourceId", "sourceUrl", "text", "updatedAt", "verification" FROM "Fragment";
DROP TABLE "Fragment";
ALTER TABLE "new_Fragment" RENAME TO "Fragment";
CREATE INDEX "Fragment_mapId_rowId_colId_idx" ON "Fragment"("mapId", "rowId", "colId");
CREATE INDEX "Fragment_mapId_reviewState_idx" ON "Fragment"("mapId", "reviewState");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
