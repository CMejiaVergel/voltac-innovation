-- CreateTable
CREATE TABLE "Concept" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "statement" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "impDemanda" INTEGER NOT NULL DEFAULT 0,
    "impImplementar" INTEGER NOT NULL DEFAULT 0,
    "impEscalar" INTEGER NOT NULL DEFAULT 0,
    "fitProblema" INTEGER NOT NULL DEFAULT 0,
    "fitEquipo" INTEGER NOT NULL DEFAULT 0,
    "fitMetas" INTEGER NOT NULL DEFAULT 0,
    "color" TEXT NOT NULL DEFAULT '',
    "reviewState" TEXT NOT NULL DEFAULT 'ACCEPTED',
    "origin" TEXT NOT NULL DEFAULT 'HUMAN',
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "authorId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Concept_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Concept_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ConceptSource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conceptId" TEXT NOT NULL,
    "ideaId" TEXT,
    "textSnapshot" TEXT NOT NULL DEFAULT '',
    "insightId" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ConceptSource_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "Concept" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ConceptSource_ideaId_fkey" FOREIGN KEY ("ideaId") REFERENCES "InsightIdea" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Assumption" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conceptId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "likelihood" INTEGER NOT NULL DEFAULT 3,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "note" TEXT NOT NULL DEFAULT '',
    "questionId" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "origin" TEXT NOT NULL DEFAULT 'HUMAN',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Assumption_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "Concept" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Assumption_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "OpenQuestion" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Concept_projectId_reviewState_idx" ON "Concept"("projectId", "reviewState");

-- CreateIndex
CREATE INDEX "ConceptSource_conceptId_idx" ON "ConceptSource"("conceptId");

-- CreateIndex
CREATE UNIQUE INDEX "ConceptSource_conceptId_ideaId_key" ON "ConceptSource"("conceptId", "ideaId");

-- CreateIndex
CREATE INDEX "Assumption_conceptId_idx" ON "Assumption"("conceptId");
