-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_FragmentRevision" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mapId" TEXT NOT NULL DEFAULT '',
    "fragmentId" TEXT,
    "action" TEXT NOT NULL,
    "text" TEXT,
    "rowId" TEXT,
    "colId" TEXT,
    "verification" TEXT,
    "reviewState" TEXT,
    "note" TEXT,
    "editedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FragmentRevision_fragmentId_fkey" FOREIGN KEY ("fragmentId") REFERENCES "Fragment" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "FragmentRevision_editedById_fkey" FOREIGN KEY ("editedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_FragmentRevision" ("action", "colId", "createdAt", "editedById", "fragmentId", "id", "note", "reviewState", "rowId", "text", "verification") SELECT "action", "colId", "createdAt", "editedById", "fragmentId", "id", "note", "reviewState", "rowId", "text", "verification" FROM "FragmentRevision";
DROP TABLE "FragmentRevision";
ALTER TABLE "new_FragmentRevision" RENAME TO "FragmentRevision";
CREATE INDEX "FragmentRevision_fragmentId_idx" ON "FragmentRevision"("fragmentId");
CREATE INDEX "FragmentRevision_mapId_idx" ON "FragmentRevision"("mapId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
