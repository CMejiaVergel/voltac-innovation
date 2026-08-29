# Plataforma de Innovación GIMI — Reto Cabot Cartagena

Especificación para construir una aplicación web que soporte el proceso completo de
innovación GIMI/IXL aplicado al reto de Cabot en Caribe Innova 2026.

Se adjunta `bom-cabot.html`: un prototipo funcional de la primera etapa. **Úsalo como
referencia de estructura de datos, contenido semilla y lenguaje visual, no como base de
código.** El proyecto nuevo se construye desde cero con un stack propio.

---

## 1. Contexto del proyecto

**Programa:** Caribe Innova 2026. Un equipo de participantes trabaja el reto de una
empresa usando la metodología del GIM Institute, con mentoría de IXL Center.

**Empresa:** Cabot Corporation, planta de Cartagena (corredor industrial de Mamonal,
Colombia). Produce negro de humo desde 1964.

**Reto textual entregado por la empresa:**

> Reducción del 10% del consumo de agua cruda (600 kg/h CT1, 400 kg/h CT2) por
> enfriamiento a través del reuso de aguas de rechazo en plantas vecinas.

**Qué hacer (según Cabot):**
- Buscar en empresas del sector purgas de caldera, torres de enfriamiento y condensados
  de stripping que puedan usarse para quench o refrigeración
- Caracterizar efluentes procurando especies y concentraciones similares al agua cruda
- Evaluar método de transporte y almacenamiento
- Evaluar requerimientos legales para nueva disposición de efluentes
- Validar modelo de precios cubriendo al menos costos de operación + 10% AIU

**Qué evitar (según Cabot):**
- Efluentes demasiado alejados de los contenidos máximos de la Resolución 631
- Cantidades muy pequeñas
- Contaminantes metálicos o que generen depósitos difíciles de manejar por evaporación
- Aguas negras
- Requerimientos de trámites legales extensos (zonas francas, permisos de vertimiento)

**Restricción económica adicional:** el ahorro en agua debe superar el gasto operativo de
traerla. Si transportarla cuesta 10, el excedente debe ser mayor a 10 para que el 10% de
ahorro quede libre.

**Dato a verificar con Cabot:** si 600+400 kg/h es realmente el 10% objetivo, equivale a
~1 m³/h ≈ 24 m³/día. La app debe permitir registrar supuestos marcados como no
confirmados.

---

## 2. La metodología (esto define la arquitectura)

Proceso IDEX del GIM Institute, en cinco etapas:

| Etapa | Propósito | Sombreros de pensamiento |
|---|---|---|
| **Configurar** | Establecer la meta | Azul, Blanco |
| **Divergir** | Generar ideas | Azul, Verde, Amarillo, Rojo |
| **Combinar** | Combinar ideas | Azul, Verde, Amarillo, Blanco, Rojo |
| **Convergir** | Priorizar ideas | Azul, Negro, Blanco |
| **Actuar** | Plan de acción | Azul, Negro, Blanco |

Sombreros: Azul = organizado/controlado, Verde = creativo/nuevas ideas, Amarillo =
optimista/positivo, Negro = cauteloso/crítico, Blanco = analítico, Rojo =
emocional/intuitivo.

### Regla metodológica crítica

**El mapa se llena con fragmentos crudos. Los insights se leen después, sobre el mapa
lleno.** La agenda oficial del taller lo confirma: primero "Manos a la obra: BOM", luego
"¿Qué es un insight?".

Un fragmento es una observación suelta que se anota aunque no encaje con nada. Un insight
es la lectura transversal que aparece al cruzar celdas. **La aplicación no debe permitir
escribir insights dentro del BOM ni etiquetar fragmentos con el insight al que
pertenecen mientras el mapa se está llenando.** Ese acoplamiento produce un mapa que
confirma conclusiones preexistentes en vez de descubrirlas. Es un error que ya se cometió
en una versión anterior y se descartó por eso.

---

## 3. Alcance por fases

Construir en este orden. Cada fase debe funcionar de forma autónoma antes de pasar a la
siguiente.

### Fase 1 — Business Opportunity Map (prioridad máxima)

Matriz de 5 dimensiones × 5 lentes = 25 celdas, cada una con N fragmentos.

**Filas (dimensiones):**

| id | Nombre | Facetas | Color |
|---|---|---|---|
| `mercado` | Mercado | Clientes · Necesidades · Experiencias | `#8B9B3C` |
| `entrega` | Entrega | Ocasiones · Localidades · Canales | `#D98B3F` |
| `oferta` | Oferta | Productos · Servicios · Marcas | `#9E6F72` |
| `produccion` | Producción | Competencias · Activos · Tecnologías | `#6B7C8C` |
| `modelos` | Modelos de Negocio | Redes y Aliados · Modelos de Precio | `#4E8C85` |

**Columnas (lentes), en este orden exacto:**

| id | Nombre | Pregunta guía |
|---|---|---|
| `compania` | Su Compañía | Qué es Cabot hoy en esta dimensión |
| `futuro` | Futuro | Hacia dónde va en 5–10 años |
| `compet` | Competidores | Qué hacen bien los rivales |
| `adyac` | Adyacencias | Qué mecanismo resolvió otra industria ajena |
| `cadena` | Cadena de Valor | Quién está aguas arriba y aguas abajo |

**Nota sobre Adyacencias:** debe registrarse como mecanismo trasladable, no como nombre
de empresa. "Coca-Cola" no sirve; "devuelve a la cuenca el agua que consume mediante
programas de reposición" sí. La UI debe reforzar esto con un placeholder o ayuda.

**Requisitos funcionales:**
- Crear, editar en línea y eliminar fragmentos
- Arrastrar fragmentos entre celdas
- Persistencia real en base de datos, no en el navegador
- Cada fragmento con campos: texto, fuente (URL o cita), estado de verificación
  (verificado / por confirmar / supuesto), autor, timestamp
- Indicador de celdas con menos de 3 fragmentos (detectar lentes no explorados)
- Exportar e importar JSON
- Exportar a PDF con la matriz completa legible
- Historial de cambios por fragmento

El contenido semilla está en el objeto `SEED` del HTML adjunto. Migrarlo tal cual,
marcando cada fragmento con su estado de verificación.

### Fase 2 — Insights

Se habilita solo cuando el BOM tenga contenido. Cada insight referencia N fragmentos del
mapa (relación muchos a muchos) y tiene:
- Titular (frase memorable)
- Evidencia (fragmentos vinculados desde el BOM)
- Tensión o contradicción que revela
- Analogía cross-industry con su mecanismo
- Implicación para el reto

Vista de lectura transversal: seleccionar fragmentos de distintas celdas y ver qué
patrón forman antes de nombrarlos.

### Fase 3 — Fields of Play

Regla de validación obligatoria del material GIMI: **un Field of Play no puede componerse
de fragmentos provenientes únicamente de nuevas ofertas de producto.** Debe cruzar al
menos dos dimensiones. La app debe advertir cuando un FOP no cumple.

Un FOP puede estar dentro del núcleo, extenderse más allá con solapamiento, o quedar
lejos del núcleo sin solapamiento.

### Fase 4 — Conceptos de solución

Plantilla oficial de cinco elementos, generados desde un **punto ancla** (hot spot) del
mapa:
- ¿Quién tiene el problema? (consumidores)
- ¿Cuáles son las necesidades? (necesidades y experiencias)
- ¿Cuál es la solución? (productos, servicios, otros)
- ¿Quién la está ofreciendo? (actores clave)
- ¿Cómo lo resolverá? (aliados, modelos de negocio, activos)

Meta: 4 a 5 conceptos.

### Fase 5 — Convergencia

Matriz oficial de priorización, escala 1 a 5:

- **Impacto:** tiene más demanda + fácil de implementar + fácil de escalar
- **Fit:** resuelve el problema + atractivo para el equipo + ayuda a alcanzar las metas

Visualización en cuadrante Impacto (eje Y) vs Fit (eje X), con el cuadrante superior
derecho marcado como Prioridad Alta. Calcular totales automáticamente.

### Transversal

- Registro de qué sombrero de pensamiento aplica en cada etapa, como recordatorio de UI
- Banco de preguntas pendientes para Cabot, con estado de respuesta
- Bibliografía centralizada: toda afirmación debe poder rastrearse a una fuente

---

## 4. Stack sugerido

- Next.js (App Router) + TypeScript
- Tailwind CSS
- SQLite vía Prisma para desarrollo local; Postgres si se despliega
- dnd-kit para arrastrar y soltar
- Sin autenticación en la primera versión; el equipo trabaja en una instancia local

Si el equipo prefiere algo más simple, Vite + React + un backend Express con SQLite
también sirve. Lo innegociable es que la persistencia sea de servidor, no `localStorage`.

---

## 5. Dirección visual

Referencia: el prototipo adjunto. Mantener:
- Tablero claro tipo papel sobre fondo oscuro
- Franja de color sólido a la izquierda de cada dimensión
- Fragmentos como post-its rosados con tipografía manuscrita, evocando el taller
  presencial donde se hizo el ejercicio con papelitos
- Encabezados de columna fijos al hacer scroll

No es decoración: el equipo hizo este ejercicio físicamente con post-its y la
correspondencia visual reduce la fricción al pasar del taller a la herramienta.

---

## 6. Fuentes ya verificadas

Migrar como bibliografía inicial:

- Cabot Corporation, 2030 Sustainability Goals y 2025 Sustainability Report (sept. 2025).
  Meta de reducir 10% la intensidad de captación de agua dulce en sitios con estrés
  hídrico. Calificación A- en CDP Water Security 2025. Meta de exportar 250% de la
  energía que importa.
- MinAmbiente Colombia, Resolución 1256 de 2021. Reglamenta reúso y recirculación de
  aguas residuales. Elimina los parámetros de calidad para uso industrial, dejándolos a
  definición de cada actividad. Define el Punto de Control como responsabilidad del
  Usuario Receptor.
- MinAmbiente Colombia, Resolución 631 de 2015. Norma de vertimiento, citada por Cabot en
  el "Qué Evitar".
- Acuacar / prensa nacional, mayo 2026. Racionamiento programado de agua en Cartagena.
- Kalundborg Symbiosis. 17 empresas, más de 30 flujos de recursos, 4 millones de m³/año
  de agua subterránea ahorrada.
- Uber Freight. Millas vacías entre 20% y 35% del sector; 44,9% en transportistas de
  cisterna; reducción de 22,6% mediante agrupamiento algorítmico.
- ARENA / Tesla / AGL. Virtual Power Plant de Australia del Sur, hasta 50.000 hogares
  agregados para entregar 250 MW y 650 MWh.
- UN ESCWA DEPAR, "Business Opportunity Mapping". Descripción pública del método:
  fragmentos de idea, metáfora del mapa estelar, identificación de tendencias y
  oportunidades como constelaciones.

---

## 7. Advertencias

1. **No acoplar insights al BOM.** Ver sección 2. Es el error que motivó rehacer el
   prototipo anterior.
2. **No inventar datos de Cabot.** Varios números clave siguen sin confirmar: consumo
   total de agua, costo por m³, especificación de calidad de CT1 y CT2, si el sitio está
   clasificado como zona de estrés hídrico. Deben quedar visiblemente marcados como
   pendientes, nunca rellenados con estimaciones que luego se lean como hechos.
3. **La fuente primaria es IXL Center.** Si el material oficial del programa contradice
   algo de esta especificación, manda el material oficial.
