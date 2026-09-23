# Etapas 4 y 5 — Convergir y Actuar (Taller 3)

Material de origen: *Taller 3 · Conceptos de negocio y artefactos de innovación*
(IXL Center / GIMI, Caribe Innova, 17-sep-2026), más las correcciones de mentor
de la sesión presencial. La plataforma codifica todo esto en `src/lib/gimi.ts`;
aquí va lo que el agente necesita para no desviarse.

## 1. Concepto de negocio — «Conecte los puntos» (Ejercicio 1.1)

Se parte de un **ancla** (el hotspot del mapa) y se une **un punto de cada fila**
—mercado, entrega, oferta, producción, modelos de negocio— en una sola frase:

> Ofreceremos **{oferta}** a/para **{mercado}**, quien necesita **{necesidad}**,
> entregado a través de **{entrega}**, producido por **{producción}**, y
> generamos dinero mediante **{modelo}**.

Más la **propuesta de valor** en una frase y el **lienzo**: viñetas propias por
dimensión (`lienzo: { mercado: [...], entrega: [...], oferta: [...], produccion: [...], modelos: [...] }`).

Reglas:
- **Completo = recorre las cinco dimensiones**, con al menos un fragmento
  ACEPTADO del mapa en cada una (`fragmentos`). Si una dimensión no tiene
  sostén en el mapa, se investiga o se reformula; no se inventa.
- **Robusto** = responde las preguntas por dimensión: a quién va dirigida y qué
  más se usa hoy; dónde, por qué canal y cuándo se ofrece; qué productos,
  servicios y marca; qué activos, tecnologías y competencias; cómo se hace
  dinero, con qué modelo de precio y con qué aliados.
- **Tipo** (lo calcula la plataforma por la columna de los fragmentos): todos
  en la columna de la compañía → incremental; mezcla → disruptivo; ninguno →
  radical.
- Se formulan **hasta 5** y el equipo **elige 3**.

## 2. Priorización — Atractividad × Fit (Ejercicio 2)

Escala 1–5; cada eje es el promedio de sus tres preguntas. **No se puntúa si el
equipo no lo pidió**, y nunca sin justificación.

| Eje | Qué mide | Preguntas (`puntuacion`) |
|---|---|---|
| Atractividad | Impacto potencial en la organización | `mercado` tamaño del mercado · `opciones` opciones adicionales · `recompensa` recompensa / riesgo |
| Fit | Si hay medios —del equipo y del sponsor— para hacerlo realidad | `viabilidad` · `estrategia` ligado a la estrategia · `pasion` sinergia entre el concepto y la mirada del mercado, el sponsor y el equipo |

## 3. Ingeniería inversa — «Hacer primero lo primero»

Pregunta: *¿qué tiene que suceder o ser una realidad para que el concepto sea
un éxito?* Se trabaja primero en las tres cosas que más preocupan.

Reglas (del mentor, obligatorias):
1. Una **condición** es algo que **tiene que llegar a existir** para que el
   concepto se ejecute. No es una barrera a verificar.
2. Lo que el proceso **ya dio por sentado** —precedentes, barreras conocidas—
   va como `tipo: PRECEDENTE`. Ejemplo: «no existe hoy un custodio de datos en
   el corredor» (si existiera, el sponsor habría acudido a él).
3. **Consolidar dependientes.** Si B solo puede existir cuando ocurre A
   («levantar el anonimato» → «cerrar un acuerdo real»), son UNA condición.
   Separarlas multiplica la improbabilidad y hunde a la dependiente.
4. Pocas e independientes, **hasta 10**. No hay que llenar diez renglones.
5. Cada condición lleva su **detonante**: modelo de negocio, proveedor,
   empleados, producción, oferta, entrega, clientes, aliados, competencia.
6. Se marcan **exactamente 3** como `critica` (las menos probables).
7. Cada crítica lleva `prueba` —falla rápida, con número de interlocutores:
   «Hablar con 5 plantas generadoras»— y `resultado` —meta contable:
   «Carta de intención con al menos 2»—.

Para corregir: `supuestosEditar` (por id), `supuestosEliminar` (al consolidar),
`supuestosNuevos`. La respuesta trae `avisosIngenieriaInversa` si algo falta.

## 4. Artefactos (Actuar)

- Se empieza por el **brochure** (2 páginas) para ir rápido, validar y
  encontrar aliados; el **protocepto** es la versión extendida, **máximo 3
  hojas**. Secciones: Problema (datos y pain points) · Solución (concepto,
  propuesta de valor, características y mockup) · Diferenciación (3) ·
  Impacto (3 beneficios para la empresa) · Equipo (nombres, roles, fotos).
- Cada formato valida insights distintos del negocio (precio, ventas, riesgo,
  especificación, cliente, producción, inversión, distribución): ver la matriz
  en la guía de la pantalla Artefactos o en `MATRIZ_ARTEFACTOS`.
- **Iterar al menos 7 veces**: hacer → probar con el mercado → revisar
  hallazgos → cambiar. Cada vuelta se registra con `editar_artefacto` →
  `iteracion`.
- Ejecutivo, visual, conciso. Datos externos con fuente; no inventar
  información, alianzas ni capacidades. Texto legible impreso: si no cabe, se
  reorganiza, no se achica.

## 5. Cierre de sesión

Cada taller cierra con **lecciones aprendidas** (3 aprendizajes y lo que más se
disfrutó, consolidados sin repetir factores) y **siguientes pasos**. Viven en la
pantalla Artefactos, por sesión. El agente no las escribe: son del equipo.

## 6. Producir un artefacto de punta a punta (replicable en cualquier proyecto)

1. `prompt_artefacto` con el concepto y el formato (`BROCHURE`, `PROTOCEPTO` o
   `MOCKUP`). Devuelve un prompt con todos los datos del proyecto y las reglas
   de diseño; con `guardarEn` lo escribe en un .md local.
2. Producir el HTML siguiendo ese prompt al pie de la letra (hojas exactas,
   cifras con etiqueta, ícono por bloque, letra legible). Medir que nada se
   desborde antes de entregar.
3. `proponer_artefacto`: concepto, título, formato, promesa, las tres
   condiciones críticas en `supuestos` y cada cifra visible en `cifras`
   (HECHO solo con `fragmentoId`).
4. `cargar_documento_artefacto` con el id y la ruta local del .html. Si
   devuelve avisos de porcentajes no declarados, se corrige el documento o la
   ficha.
5. Cada vez que el equipo lo prueba y lo cambia: nueva versión con
   `cargar_documento_artefacto` y `editar_artefacto` → `iteracion` + 1.
