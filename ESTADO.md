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
Aprobar y subir el **Concepto 03 · Red de agua lluvia de Mamonal** (diseño para un año seco: 3 ha, ≈1.100 m³, operador con cuota bajo tarifa y cesión final). Después, decidir el 04 (candidato: «Calor en vez de agua»). Antes era: rehacer el Concepto 03 con la misma estructura (pitch de 1 minuto + brochure + protocepto v2).
Falta que Carlos decida cuál concepto es el 03 entre:
- Enfriamiento evitado;
- Medición de efluentes como servicio;
- Agua verificada.

Las dos últimas se cruzan con la plataforma Custodio del concepto 02.

**Pendiente de investigación jurídica.** Estos puntos NO se mencionan en los conceptos; se investigan para la próxima versión:
1. La Res. 1256/2021 solo reconoce al usuario generador y al usuario receptor: no contempla intermediario ni operador. Por eso el operador del concepto 02 es de Cabot.
2. Concesión de aguas del receptor (Cabot): tiempos, costos, información técnica, y si la otorga Cardique o el EPA Cartagena.
3. La responsabilidad de cumplimiento recae en el receptor (art. 4, parágrafo 2).
4. Qué pasa con el permiso de vertimiento del vecino cuando cede parte de su agua.
5. Tubería entre predios: servidumbres y ocupación de vías (trámites municipales).
6. Si tanque y bombeo en el predio de Cabot exigen ajustar algún permiso o plan ambiental.
7. Vecinos en zona franca: posible trámite aduanero.
8. Certificados de impacto: solo los emite un organismo acreditado por ONAC (ISO/IEC 17029, ISO 14065; huella hídrica NTC-ISO 14046, por ejemplo ICONTEC). Voltac entrega datos trazables y verificables, y busca un verificador aliado.
9. **Agua lluvia (concepto 03).** El Decreto 1076 de 2015 (art. 2.2.3.2.16.13, con el Decreto 1090 de 2018):
   - usar el agua lluvia que cae en el propio predio no requiere concesión mientras discurra por él;
   - sí la requiere si forma cauce entre varios predios o sale del predio, como la de techos de vecinos llevada a Cabot.

   Hay que confirmar:
   - si la excepción aplica a uso industrial con bombeo, porque algunas lecturas la limitan a usos domésticos sin bombeo;
   - que la escorrentía de patios con contacto de proceso no se trate como agua residual;
   - que la cuota del operador se cobre por el servicio de infraestructura y no como venta de agua, porque el agua lluvia es de dominio público;
   - si un tercero que entrega agua a una empresa cae en la Ley 142 de servicios públicos.

   La Ley 373 de 1997 juega a favor: pide incluir la oferta de agua lluvia en los proyectos que consumen agua.

## Decisiones tomadas
- **Retroalimentación de los mentores (sept 2026).** Cada concepto recorre las 5 dimensiones del BOM y trae indicadores de impacto traducidos a pesos. El ROI no se escribe explícito. Los pasos y los puntos débiles salen de la ingeniería inversa.
- **Cabot primero.** El potencial para el ecosistema queda implícito.
- **Precios de referencia:**
  - Agua: tarifa pública de Acuacar, uso industrial, 2.º semestre de 2026: $4.384,90/m³ (fragmento aceptado). 1 m³/h = 8.760 m³/año ≈ $38,4 M/año.
  - Flete de carrotanque: $250–400 mil por viaje, según el equipo (por confirmar), es decir $12.500–40.000/m³. Por carretera no es viable: hace falta conducción directa.
- **Concepto 01 · Custodio Hídrico:** modelo B. Es la puerta de entrada gratis y cobra por servicios adicionales.
- **Concepto 02 · Operador de agua de rechazo de Cabot:**
  - Es una extensión de Cabot que opera en su predio.
  - Los vecinos ceden el agua sin costo.
  - El ahorro ($38,4 M/año por m³/h) paga la inversión; ≈ $115 M equivalen a 3 años de ahorro.
  - Voltac pone el diseño del sistema (una sola vez) y la plataforma Custodio, con canon mensual tipo SaaS: muestra indicadores económicos y ambientales y datos verificables.
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
### 2026-10-02 — Conceptos 01 y 02 publicados
- **Concepto 01:** v2.1 sin el dato del carrotanque; el algoritmo ahora explica compatibilidad y viabilidad. Los v2 con flete quedaron como historial.
- **Concepto 02:** replanteado como operador propio de Cabot y publicado (concepto y artefactos v2).
- Pitch consolidado en `VOLTAC_DOCSCARIBE INNOVA 2026Artifacts V2Pitch de conceptos - 1 minuto cada uno.md`.
- Fragmento de la Res. 1256 corregido: no fija criterios ambientales para el reúso industrial.
- `exportar-artefacto.ps1` ahora avisa cuando el contenido se pasa de su zona.

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
