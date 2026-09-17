-- CreateTable
CREATE TABLE "ConceptFragment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conceptId" TEXT NOT NULL,
    "fragmentId" TEXT,
    "rowId" TEXT NOT NULL DEFAULT '',
    "textSnapshot" TEXT NOT NULL DEFAULT '',
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ConceptFragment_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "Concept" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ConceptFragment_fragmentId_fkey" FOREIGN KEY ("fragmentId") REFERENCES "Fragment" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ConceptFragment_conceptId_idx" ON "ConceptFragment"("conceptId");

-- CreateIndex
CREATE UNIQUE INDEX "ConceptFragment_conceptId_fragmentId_key" ON "ConceptFragment"("conceptId", "fragmentId");

