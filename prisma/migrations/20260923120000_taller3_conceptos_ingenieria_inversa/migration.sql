-- Taller 3 (Caribe Innova, 17-sep-2026): conceptos de negocio, priorizacion
-- Atractividad x Fit, ingenieria inversa, iteracion de artefactos y lecciones.
-- Escrita a mano: los seis puntajes se RENOMBRAN para conservar lo ya puntuado.

-- Priorizacion del Ejercicio 2: Atractividad (mercado, opciones, recompensa/riesgo)
-- y Fit (viabilidad, ligado a la estrategia, pasion).
ALTER TABLE "Concept" RENAME COLUMN "impDemanda"     TO "atrMercado";
ALTER TABLE "Concept" RENAME COLUMN "impEscalar"     TO "atrOpciones";
ALTER TABLE "Concept" RENAME COLUMN "fitProblema"    TO "atrRecompensa";
ALTER TABLE "Concept" RENAME COLUMN "impImplementar" TO "fitViabilidad";
ALTER TABLE "Concept" RENAME COLUMN "fitMetas"       TO "fitEstrategia";
ALTER TABLE "Concept" RENAME COLUMN "fitEquipo"      TO "fitPasion";

-- Ejercicio 1.1: frase «Conecte los puntos», propuesta de valor y lienzo.
ALTER TABLE "Concept" ADD COLUMN "fraseOferta"     TEXT NOT NULL DEFAULT '';
ALTER TABLE "Concept" ADD COLUMN "fraseMercado"    TEXT NOT NULL DEFAULT '';
ALTER TABLE "Concept" ADD COLUMN "fraseNecesidad"  TEXT NOT NULL DEFAULT '';
ALTER TABLE "Concept" ADD COLUMN "fraseEntrega"    TEXT NOT NULL DEFAULT '';
ALTER TABLE "Concept" ADD COLUMN "fraseProduccion" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Concept" ADD COLUMN "fraseModelo"     TEXT NOT NULL DEFAULT '';
ALTER TABLE "Concept" ADD COLUMN "propuestaValor"  TEXT NOT NULL DEFAULT '';
ALTER TABLE "Concept" ADD COLUMN "lienzo"          TEXT NOT NULL DEFAULT '{}';

-- Ingenieria inversa: condiciones vs precedentes, detonante, las tres menos
-- probables, prueba de falla rapida y resultado esperado.
ALTER TABLE "Assumption" ADD COLUMN "kind"           TEXT NOT NULL DEFAULT 'CONDICION';
ALTER TABLE "Assumption" ADD COLUMN "trigger"        TEXT NOT NULL DEFAULT '';
ALTER TABLE "Assumption" ADD COLUMN "critical"       BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Assumption" ADD COLUMN "failFastTest"   TEXT NOT NULL DEFAULT '';
ALTER TABLE "Assumption" ADD COLUMN "expectedResult" TEXT NOT NULL DEFAULT '';

-- Artefactos: vuelta del ciclo hacer-probar-revisar-cambiar (minimo siete).
ALTER TABLE "Artifact" ADD COLUMN "iteration" INTEGER NOT NULL DEFAULT 1;

-- Lecciones aprendidas y proximos pasos de cada sesion.
CREATE TABLE "Leccion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "sesion" TEXT NOT NULL DEFAULT '',
    "tipo" TEXT NOT NULL DEFAULT 'APRENDIZAJE',
    "texto" TEXT NOT NULL,
    "hecho" BOOLEAN NOT NULL DEFAULT false,
    "authorId" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Leccion_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Leccion_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "Leccion_projectId_sesion_idx" ON "Leccion"("projectId", "sesion");
