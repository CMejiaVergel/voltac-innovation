-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_OpenQuestion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "askedTo" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "answer" TEXT NOT NULL DEFAULT '',
    "origin" TEXT NOT NULL DEFAULT 'HUMAN',
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OpenQuestion_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_OpenQuestion" ("answer", "askedTo", "createdAt", "id", "origin", "projectId", "status", "text", "updatedAt") SELECT "answer", "askedTo", "createdAt", "id", "origin", "projectId", "status", "text", "updatedAt" FROM "OpenQuestion";
DROP TABLE "OpenQuestion";
ALTER TABLE "new_OpenQuestion" RENAME TO "OpenQuestion";
CREATE INDEX "OpenQuestion_projectId_status_idx" ON "OpenQuestion"("projectId", "status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
