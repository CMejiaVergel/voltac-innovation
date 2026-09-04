-- CreateTable
CREATE TABLE "Insight" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "tag" TEXT NOT NULL DEFAULT '',
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

-- CreateTable
CREATE TABLE "InsightDot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "insightId" TEXT NOT NULL,
    "fragmentId" TEXT,
    "textSnapshot" TEXT NOT NULL DEFAULT '',
    "rowId" TEXT NOT NULL DEFAULT '',
    "colId" TEXT NOT NULL DEFAULT '',
    "role" TEXT NOT NULL DEFAULT 'APOYO',
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InsightDot_insightId_fkey" FOREIGN KEY ("insightId") REFERENCES "Insight" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InsightDot_fragmentId_fkey" FOREIGN KEY ("fragmentId") REFERENCES "Fragment" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InsightIdea" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "insightId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "origin" TEXT NOT NULL DEFAULT 'HUMAN',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InsightIdea_insightId_fkey" FOREIGN KEY ("insightId") REFERENCES "Insight" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Insight_projectId_reviewState_idx" ON "Insight"("projectId", "reviewState");

-- CreateIndex
CREATE INDEX "InsightDot_insightId_idx" ON "InsightDot"("insightId");

-- CreateIndex
CREATE INDEX "InsightDot_fragmentId_idx" ON "InsightDot"("fragmentId");

-- CreateIndex
CREATE UNIQUE INDEX "InsightDot_insightId_fragmentId_key" ON "InsightDot"("insightId", "fragmentId");

-- CreateIndex
CREATE INDEX "InsightIdea_insightId_idx" ON "InsightIdea"("insightId");
