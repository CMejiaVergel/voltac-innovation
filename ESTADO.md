# ESTADO — innovacion\plataforma-innovacion

> Bitácora para retomar el trabajo con un asistente de IA. Léela al empezar; actualízala al terminar.
> Instrucciones generales: `Desktop\VOLTAC_DEV\AGENTS.md`.

## Resumen
Plataforma de innovación GIMI/IDEX de Voltac Systems: Mapa de Oportunidades (BOM), agente
investigador, insights, conceptos de negocio, ingeniería inversa y artefactos. Primer reto en
producción: reuso de agua de rechazo para Cabot Cartagena (Caribe Innova 2026), trabajado con
E&E Ingeniería.

## Estado actual
- Fase / versión: las cinco etapas IDEX están construidas. Falta el plan de acción de Actuar.
- En producción: https://innovation.voltac.com.co. El proyecto real es `reuso-de-agua-de-rechazo-cabot-cartagena-prueba-`.
- Funciona: `npm run dev` y `npm run typecheck`; el MCP (`mcp/server.mjs`) contra producción.
- Roto / pendiente:
  - El MCP nativo de Claude Code necesita `VOLTAC_API_TOKEN`, que está en `.claude/settings.local.json` (ignorado por git). Si responde «Token ausente», hay que abrir Claude Code en esta carpeta.
  - El aviso «4% no declarado» en los artefactos v2 del concepto 01 es solo una diferencia de texto: la cifra se declaró como «4% del sitio».

## Siguiente paso
Rehacer el **Concepto 02 · Operador de Agua de Rechazo** (brochure y protocepto v2), con la misma
estructura del concepto 01. Antes hay que tomar tres decisiones con Carlos:
1. Quién invierte en la conducción corta y el tanque. Recomendado: el operador, que la recupera por tarifa.
2. Si se le paga al generador. Recomendado: cesión sin costo, con reparto del ahorro solo si hoy paga por disponer el agua.
3. El nivel de continuidad. Recomendado: 60% de las horas, y 90% al entrar la segunda fuente.

Cifras base:
- techo de costo de operar: $4.384,90 ÷ 1,10 (AIU) = $3.986/m³;
- costo anual máximo: $34,9 M;
- cada 1% de continuidad vale $384 mil/año.

## Decisiones tomadas
- **Retroalimentación de los mentores (sept 2026).** Cada concepto recorre las 5 dimensiones del BOM y trae indicadores de impacto traducidos a pesos. El ROI no se escribe explícito. Los pasos y los puntos débiles salen de la ingeniería inversa.
- **Cabot primero.** El potencial para el ecosistema queda implícito.
- **Precios de referencia:**
  - Agua: tarifa pública de Acuacar, uso industrial, 2.º semestre de 2026: $4.384,90/m³ (fragmento aceptado). 1 m³/h = 8.760 m³/año ≈ $38,4 M/año.
  - Flete de carrotanque: $250–400 mil por viaje, según el equipo (por confirmar), es decir $12.500–40.000/m³. Por carretera no es viable: hace falta conducción directa.
- **Concepto 01 · Custodio Hídrico:** modelo B. Es la puerta de entrada gratis y cobra por servicios adicionales.
- **Renumeración de conceptos:**
  - 01 = Custodio Hídrico;
  - 02 = Operador de Agua de Rechazo;
  - los demás esperan número.
- **Documentos:** viven en `Desktop\VOLTAC_DOCS\CARIBE INNOVA 2026\`; la v2 va en `Artifacts V2\`. Los v1 no se borran (trazabilidad). En la plataforma, los v2 son artefactos nuevos y los v1 llevan «(v1)» en el título.

## Cómo arrancar
```bash
npm install
npx prisma generate
npm run dev
```
Exportar un artefacto (mide desbordes, imprime PDF y toma una captura):
```powershell
powershell -File scripts\exportar-artefacto.ps1 -Html "<ruta del .html>"
```

## Bitácora
### 2026-09-30 — Retomar tras la migración
- Se verificó el entorno nuevo: `npm install`, Prisma (15 migraciones al día) y typecheck sin errores. El token del MCP funciona contra producción.
- Nueva herramienta `scripts/exportar-artefacto.ps1`. Reemplaza los scripts sueltos que se usaron para el concepto 01.
- Se completó este ESTADO con el contexto acumulado desde el formateo del PC (2026-09-28).

### 2026-09-29 — Concepto 01 v2
- El Custodio Hídrico se rehízo con la retroalimentación de los mentores: indicadores en pesos, filtro de costo puesto en planta y Cabot primero.
- Se publicaron en la plataforma el brochure (iteración 3) y el protocepto (iteración 4).
- Se agregaron al mapa dos fragmentos: la tarifa de Acuacar y el flete de referencia.

### 2026-09-30 — Migración
- Movido desde `G:\My Drive\VOLTAC_SYSTEMS\PROJECTS\CARIBE INNOVA 2026\Metodology Software` a `VOLTAC_DEV\innovacion\plataforma-innovacion` (fuera de Google Drive).
- `node_modules` y `.next` no se copiaron: correr `npm install`.
