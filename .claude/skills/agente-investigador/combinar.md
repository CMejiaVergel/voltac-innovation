# Etapa 3 — Combinar (Connect the Dots)

Esta es la **otra mitad** del trabajo del agente, y es una tarea distinta de la
de Divergir. Conviene tenerlo claro antes de empezar:

| | Divergir | Combinar |
|---|---|---|
| Qué haces | Sales a buscar | Lees lo que ya hay |
| Fuente | La web | **Solo el mapa** |
| Salida | Fragmentos crudos | Insights que conectan puntos |
| Prohibición mayor | Concluir | Aportar hechos nuevos |

En Divergir tienes **prohibido concluir**. En Combinar tienes **prohibido traer
hechos de fuera**: un dato que no está en el mapa no pasó por la verificación
del equipo, y meterlo aquí lo colaría por la puerta de atrás.

---

## La anatomía: patrón → hecho → implicación

Esto costó seis iteraciones sobre el reto de Cabot y tres correcciones de
mentor. Léelo entero antes de escribir uno.

Un **dato** describe el mundo. Un **insight** hace que quien escucha vea una
oportunidad que no veía, usando información que ya tenía.

Son tres piezas, en este orden, y las tres tienen que estar.

### 1. El patrón

Una regularidad **difícilmente cuestionable**. Algo que quien escucha reconoce
como cierto sin pedir prueba. No es una hipótesis del equipo ni una tendencia
de mercado: es una regla del mundo que la sala acepta al oírla.

Se escribe **en general**. Todavía no nombras a la empresa del reto.

- **Bien:** «En una planta de producción industrial cada hora parada es pérdida
  directa: todo lo que entra a la operación debe estar disponible las 24 horas.»
- **Bien:** «Ninguna empresa industrial firma un acuerdo cuyas obligaciones
  legales no puede determinar.»
- **Bien:** «Enfriar un efluente para poder verterlo es costo puro: no mejora el
  producto ni la producción.»
- **Mal:** «El mercado del agua industrial va a crecer.» → es un pronóstico
- **Mal:** «Las empresas del corredor quieren colaborar.» → ¿cómo lo sabes?

> **La prueba:** si alguien en la sala puede responder *«eso depende»*, todavía
> no es un patrón.

### 2. El hecho

El dato del mapa que demuestra que **ese patrón se cumple aquí**, en este reto,
con esta empresa. Con cifra, con actor nombrado, y tomado de un fragmento que ya
existe.

- **Bien:** «Cabot opera al 94% de utilización y su agua la entrega un servicio
  público que administra esa continuidad; el agua de rechazo no tiene quién la
  administre.»

> **La prueba:** si no puedes señalar el punto del que sale, no lo escribas.

### 3. La implicación — el «¿y qué?»

Lo que cambia al leer las dos piezas juntas, y que ninguna decía sola. Casi
siempre es un **desplazamiento**: el problema no está donde se buscaba, o el
candidato no es el que parecía.

- **Bien:** «El obstáculo no es la calidad ni el precio: es que una interrupción
  en la planta de al lado se convierta en una parada en la propia. Y eso explica
  por qué un acuerdo entre dos plantas se queda corto.»
- **Bien:** «El primer candidato del corredor no es quien más agua tiene: es
  quien hoy tiene que enfriarla.»

> **La prueba:** si tu implicación se puede sustituir por el hecho sin perder
> nada, es una glosa.

---

## El examen: ¿abre negocio nuevo?

**La implicación tiene que abrir una oportunidad que la empresa no veía.** Eso
va en el campo `oportunidad` y no es opcional.

Un insight que solo reafirma la importancia del reto está bien escrito y no
sirve para nada. La empresa ya sabe que su reto importa: por eso lo planteó.

- **Se tira:** «El agua escasea en la región y la regulación se endurece, por lo
  que ahorrar agua es cada vez más importante.» → es el enunciado del reto con
  otras palabras.
- **Se queda:** «A Mamonal no le falta agua: le falta alguien ante quien esos
  datos sí se puedan poner.» → eso es un negocio que no estaba en la
  conversación.

Es preferible entregar **dos** insights que abran algo, a seis que reafirmen el
punto de partida. Si uno no pasa el examen, no lo maquilles: cámbialo por otro
o dilo en `notas`.

---

## Prohibiciones

**I1. No aportes hechos que no estén en el mapa.** Si te falta un dato para
cerrar un insight, dilo en `limite` en vez de inventarlo. Si es importante,
anótalo con `registrar_preguntas`. La única excepción es el patrón, que por
definición es conocimiento común — pero entonces tiene que ser de verdad
incuestionable, no un dato disfrazado.

**I2. No afirmes disposición, cita conducta.** Prohibido «estarían dispuestos
a», «les interesaría», «seguramente pagarían». Solo vale lo que **ya hicieron**
y consta en un fragmento.

> Es la que más se incumple y la primera que detecta un mentor. Un insight real
> que se cayó en revisión:
> *«Hay plantas dispuestas a pagar por quitarse calor de encima y, a menos de un
> kilómetro, plantas que pagan combustible para producir ese mismo calor.»*
> El mentor preguntó: ¿cómo sabes que están dispuestas a pagar? ¿cómo sabes que
> pagan combustible? Dos afirmaciones sin punto que las sostuviera.

**I3. No contradigas ni invalides lo que la empresa fijó explícitamente.** Las
restricciones del brief y la lista de «qué evitar» son el terreno de juego, no
una posición negociable. Si el reto descarta las cantidades muy pequeñas de
efluente, no escribas un insight que demuestre que sí servirían: no se escucha,
se rebate. Si crees que una restricción bloquea el reto, anótalo con
`registrar_preguntas`.

**I4. No te adelantes a la solución.** El insight revela; no diseña. Prohibido
prescribir el equipo o la arquitectura («hay que instalar un tanque pulmón de
X m³»). Eso es Convergir, y adelantarlo cierra el abanico antes de abrirlo.
Nombra **qué** falta, no **cómo** se construye.

**I5. Habla en general, no a un destinatario.** El insight lo va a leer gente
que no estuvo en la conversación. Nada de «como te dije», «nuestro equipo», «lo
que buscamos». Tercera persona y sujeto nombrado.

**I6. No seas más específico que tu evidencia.** Si el mapa dice «varias
plantas», no escribas «cuatro»; si dice «algunas ya caracterizaron», no escribas
«todas». La precisión de más es la que primero se cae, y arrastra el insight
entero con ella.

**I7. No repitas el fragmento.** Si tu frase se puede sustituir por uno de los
puntos que conecta, no hay insight: hay una glosa.

**I8. Declara el límite. Siempre.** Qué es lo que **no** se puede afirmar con
los puntos que tienes.

**I9. No rellenes por cuota.** Si el mapa solo da para dos insights sólidos,
entrega dos y explícalo.

**I10. No escribas dos insights que se contradigan.** Antes de entregar, léelos
juntos. Si uno dice «ninguna fuente sola puede ser firme» y otro dice «una
planta grande y estable es el candidato ideal», uno de los dos sobra.

---

## Cómo conectar

Mínimo **2** puntos; **3 o más** suele dar uno más rico, pero solo si el tercero
aporta de verdad.

| Papel | Qué hace ese punto |
|---|---|
| `PATRON` | Muestra que la regularidad se repite. Puede no haber ninguno. |
| `HECHO` | Aporta el dato duro. **Sin ninguno el insight no se sostiene.** |
| `APERTURA` | El punto por el que asoma la oportunidad. Suele ser una adyacencia. |
| `APOYO` | Refuerza, acota o matiza. |

**Cubre todas las dimensiones.** Si al terminar ninguno de tus insights toca una
dimensión entera del mapa, dilo en `notas` con el motivo. Es un hueco real que
el equipo va a tener que explicar delante del cliente, y es mejor que lo sepa
por ti que en la sala.

El **orden** de los puntos se guarda: es el recorrido del razonamiento y se
dibuja como trazo en el mapa. No lo pongas al azar.

---

## Herramientas

| Herramienta | Para qué |
|---|---|
| `leer_proyecto` | Trae los fragmentos **con su id** —que es lo que se conecta— y los insights que ya existen. Obligatorio antes de proponer. |
| `proponer_insights` | Crea insights en lote. Entran como `PROPOSED`. |
| `editar_insight` | Corrige uno existente. `puntos` e `ideas` se reemplazan enteros. |
| `eliminar_insight` | Bórralo solo si está mal de raíz. Si solo está mal escrito, edítalo. |

Campos del insight: `patron`, `hecho`, `implicacion`, `oportunidad`, `limite`,
más `enunciado` (el párrafo completo, que tiene que leerse solo) e `ideas`.

Si citas un `fragmentoId` que no existe en ese mapa, **el insight se rechaza
entero** y el motivo vuelve en la respuesta. Es deliberado: si una de sus patas
es imaginaria, el insight no se sostiene.

---

## Después: la presentación

Los insights aceptados son el centro de la presentación con la que el equipo
devuelve el trabajo a la empresa. En un pitch de siete minutos se llevan cerca
de la mitad del tiempo, y todo lo anterior —el barrido de contexto, el mapa, los
grupos de ideas— existe para que se entiendan.

Escríbelos pensando en que alguien los va a decir en voz alta delante de quien
planteó el reto.
