-- Anatomia del insight: patron -> hecho -> implicacion.
--
-- Se escribe a mano y no con `migrate dev` a proposito. Prisma no distingue un
-- renombrado de un borrado mas un alta: habria generado DROP COLUMN y los
-- cuatro insights del reto de Cabot —que ya estaban escritos con la anatomia
-- nueva, solo que metidos en los campos viejos— se habrian perdido.
--
--   counterpart -> pattern       ahi estaba escrito el PATRON
--   shift       -> implication   ahi estaba escrito el ¿Y QUE?
--
-- SQLite soporta RENAME COLUMN desde 3.25 (2018). El cliente de Node trae una
-- version muy posterior.

ALTER TABLE "Insight" RENAME COLUMN "counterpart" TO "pattern";
ALTER TABLE "Insight" RENAME COLUMN "shift" TO "implication";

-- Los textos llevaban la etiqueta de la pieza dentro del propio campo, porque
-- el campo se llamaba otra cosa y habia que marcar que era. Ahora el nombre de
-- la columna ya lo dice: sobra el prefijo.
UPDATE "Insight" SET "pattern"     = TRIM(SUBSTR("pattern", 9))     WHERE "pattern"     LIKE 'PATRÓN:%';
UPDATE "Insight" SET "pattern"     = TRIM(SUBSTR("pattern", 9))     WHERE "pattern"     LIKE 'PATRON:%';
UPDATE "Insight" SET "fact"        = TRIM(SUBSTR("fact", 7))        WHERE "fact"        LIKE 'HECHO:%';
UPDATE "Insight" SET "implication" = TRIM(SUBSTR("implication", 9)) WHERE "implication" LIKE '¿Y QUÉ?%';
UPDATE "Insight" SET "implication" = TRIM(SUBSTR("implication", 9)) WHERE "implication" LIKE '¿Y QUE?%';

-- El papel de un punto: CONTRAPARTE era la segunda punta del intercambio, que
-- ya no es la unidad de analisis. Lo que ese punto hacia en la practica era
-- abrir la implicacion, casi siempre desde una adyacencia.
UPDATE "InsightDot" SET "role" = 'APERTURA' WHERE "role" = 'CONTRAPARTE';
-- La presentacion del proyecto.
CREATE TABLE "Deck" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT NOT NULL DEFAULT '',
    "html" TEXT NOT NULL,
    "pages" INTEGER NOT NULL DEFAULT 0,
    "pageSize" TEXT NOT NULL DEFAULT '',
    "source" TEXT NOT NULL DEFAULT 'HUMAN',
    "presentedAt" DATETIME,
    "presentedTo" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Deck_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "Deck_projectId_idx" ON "Deck"("projectId");
