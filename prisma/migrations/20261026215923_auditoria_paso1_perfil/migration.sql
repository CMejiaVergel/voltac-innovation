-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PerfilInnovacion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizacionId" TEXT NOT NULL,
    "definicion" TEXT NOT NULL DEFAULT '',
    "tiposInnovacion" TEXT NOT NULL DEFAULT '[]',
    "dondeInnovar" TEXT NOT NULL DEFAULT '',
    "queNoEsInnovar" TEXT NOT NULL DEFAULT '',
    "razonesCambio" TEXT NOT NULL DEFAULT '[]',
    "argumentoCambio" TEXT NOT NULL DEFAULT '',
    "brechaCuanto" TEXT NOT NULL DEFAULT '',
    "brechaCuando" TEXT NOT NULL DEFAULT '',
    "objetivos" TEXT NOT NULL DEFAULT '[]',
    "metricas" TEXT NOT NULL DEFAULT '[]',
    "ejeGeografico" INTEGER NOT NULL DEFAULT 0,
    "ejeNovedad" INTEGER NOT NULL DEFAULT 0,
    "ejeNucleo" INTEGER NOT NULL DEFAULT 0,
    "ejeInversion" INTEGER NOT NULL DEFAULT 0,
    "ejePlazo" INTEGER NOT NULL DEFAULT 0,
    "ejeOportunidad" INTEGER NOT NULL DEFAULT 0,
    "ejePosicion" INTEGER NOT NULL DEFAULT 0,
    "perfilOtro" TEXT NOT NULL DEFAULT '',
    "posicionActual" TEXT NOT NULL DEFAULT '',
    "posicionDeseada" TEXT NOT NULL DEFAULT '',
    "presupuesto" TEXT NOT NULL DEFAULT '',
    "horizonte" TEXT NOT NULL DEFAULT '',
    "restricciones" TEXT NOT NULL DEFAULT '[]',
    "prospeccion" TEXT NOT NULL DEFAULT '',
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PerfilInnovacion_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "Organizacion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_PerfilInnovacion" ("argumentoCambio", "brechaCuando", "brechaCuanto", "definicion", "dondeInnovar", "ejeGeografico", "ejeInversion", "ejeNovedad", "ejeNucleo", "horizonte", "id", "metricas", "objetivos", "organizacionId", "presupuesto", "prospeccion", "queNoEsInnovar", "razonesCambio", "restricciones", "tiposInnovacion", "updatedAt") SELECT "argumentoCambio", "brechaCuando", "brechaCuanto", "definicion", "dondeInnovar", "ejeGeografico", "ejeInversion", "ejeNovedad", "ejeNucleo", "horizonte", "id", "metricas", "objetivos", "organizacionId", "presupuesto", "prospeccion", "queNoEsInnovar", "razonesCambio", "restricciones", "tiposInnovacion", "updatedAt" FROM "PerfilInnovacion";
DROP TABLE "PerfilInnovacion";
ALTER TABLE "new_PerfilInnovacion" RENAME TO "PerfilInnovacion";
CREATE UNIQUE INDEX "PerfilInnovacion_organizacionId_key" ON "PerfilInnovacion"("organizacionId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
