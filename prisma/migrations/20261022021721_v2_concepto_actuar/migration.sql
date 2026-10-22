-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Concept" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "statement" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "fraseOferta" TEXT NOT NULL DEFAULT '',
    "fraseMercado" TEXT NOT NULL DEFAULT '',
    "fraseNecesidad" TEXT NOT NULL DEFAULT '',
    "fraseEntrega" TEXT NOT NULL DEFAULT '',
    "fraseProduccion" TEXT NOT NULL DEFAULT '',
    "fraseModelo" TEXT NOT NULL DEFAULT '',
    "propuestaValor" TEXT NOT NULL DEFAULT '',
    "lienzo" TEXT NOT NULL DEFAULT '{}',
    "atrMercado" INTEGER NOT NULL DEFAULT 0,
    "atrOpciones" INTEGER NOT NULL DEFAULT 0,
    "atrRecompensa" INTEGER NOT NULL DEFAULT 0,
    "fitViabilidad" INTEGER NOT NULL DEFAULT 0,
    "fitEstrategia" INTEGER NOT NULL DEFAULT 0,
    "fitPasion" INTEGER NOT NULL DEFAULT 0,
    "color" TEXT NOT NULL DEFAULT '',
    "priorizado" BOOLEAN NOT NULL DEFAULT false,
    "actuar" TEXT NOT NULL DEFAULT '{}',
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
INSERT INTO "new_Concept" ("atrMercado", "atrOpciones", "atrRecompensa", "authorId", "color", "createdAt", "description", "fitEstrategia", "fitPasion", "fitViabilidad", "fraseEntrega", "fraseMercado", "fraseModelo", "fraseNecesidad", "fraseOferta", "fraseProduccion", "hidden", "id", "lienzo", "origin", "position", "priorizado", "projectId", "propuestaValor", "reviewState", "statement", "title", "updatedAt") SELECT "atrMercado", "atrOpciones", "atrRecompensa", "authorId", "color", "createdAt", "description", "fitEstrategia", "fitPasion", "fitViabilidad", "fraseEntrega", "fraseMercado", "fraseModelo", "fraseNecesidad", "fraseOferta", "fraseProduccion", "hidden", "id", "lienzo", "origin", "position", "priorizado", "projectId", "propuestaValor", "reviewState", "statement", "title", "updatedAt" FROM "Concept";
DROP TABLE "Concept";
ALTER TABLE "new_Concept" RENAME TO "Concept";
CREATE INDEX "Concept_projectId_reviewState_idx" ON "Concept"("projectId", "reviewState");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
