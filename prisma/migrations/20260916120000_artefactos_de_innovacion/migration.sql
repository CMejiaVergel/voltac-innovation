-- CreateTable
CREATE TABLE "Artifact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "conceptId" TEXT,
    "title" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'LANDING',
    "promise" TEXT NOT NULL DEFAULT '',
    "html" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'BORRADOR',
    "presentedAt" DATETIME,
    "presentedTo" TEXT NOT NULL DEFAULT '',
    "origin" TEXT NOT NULL DEFAULT 'HUMAN',
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Artifact_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Artifact_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "Concept" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ArtifactAssumption" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "artifactId" TEXT NOT NULL,
    "assumptionId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ArtifactAssumption_artifactId_fkey" FOREIGN KEY ("artifactId") REFERENCES "Artifact" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ArtifactAssumption_assumptionId_fkey" FOREIGN KEY ("assumptionId") REFERENCES "Assumption" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ArtifactClaim" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "artifactId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'ESTIMACION',
    "basis" TEXT NOT NULL DEFAULT '',
    "fragmentId" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ArtifactClaim_artifactId_fkey" FOREIGN KEY ("artifactId") REFERENCES "Artifact" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ArtifactClaim_fragmentId_fkey" FOREIGN KEY ("fragmentId") REFERENCES "Fragment" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ArtifactFeedback" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "artifactId" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT '',
    "text" TEXT NOT NULL,
    "assumptionId" TEXT,
    "verdict" TEXT NOT NULL DEFAULT '',
    "authorId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ArtifactFeedback_artifactId_fkey" FOREIGN KEY ("artifactId") REFERENCES "Artifact" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ArtifactFeedback_assumptionId_fkey" FOREIGN KEY ("assumptionId") REFERENCES "Assumption" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ArtifactFeedback_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Artifact_projectId_idx" ON "Artifact"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ArtifactAssumption_artifactId_assumptionId_key" ON "ArtifactAssumption"("artifactId", "assumptionId");

-- CreateIndex
CREATE INDEX "ArtifactClaim_artifactId_idx" ON "ArtifactClaim"("artifactId");

-- CreateIndex
CREATE INDEX "ArtifactFeedback_artifactId_idx" ON "ArtifactFeedback"("artifactId");

