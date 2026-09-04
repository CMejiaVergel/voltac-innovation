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

## Qué es un insight válido

Esto costó tres iteraciones y una corrección de mentor. Lée­lo entero antes de
escribir uno.

Un **dato** describe el mundo. Un **insight** revela que hay alguien dispuesto
a ofrecer algo que no sabía que podía vender, y alguien dispuesto a pagarlo —
y por eso abre un caso de negocio.

### Las cinco piezas

La frase tiene que sostenerse sola, sin el desglose. Cinco piezas, todas:

1. **Un hecho con cifra y fuente**, tomado de un fragmento del mapa.
2. **Un conector causal** («por lo que», «y por eso»). El hecho *produce* la
   conducta, no solo la acompaña.
3. **Una conducta de mercado ya observada**, con su actor nombrado. Es la
   contraparte, y sale de **otro** fragmento.
4. **Una concesión** («aunque implique pagar más», «aunque exija trámite»).
   Ahí está el margen del negocio.
5. **Un porqué**: la motivación que explica que acepten esa concesión.

### El modelo, de otro sector

> «En España un estudio determinó que fumar al volante eleva el riesgo de
> accidente casi un 50%, **por lo que** los pasajeros, en especial los
> corporativos, lo tienen en cuenta al tomar un taxi **aunque implique pagar
> más**, **ya que** prefieren confort y seguridad.»

---

## Prohibiciones

**I1. No aportes hechos que no estén en el mapa.** Si te falta un dato para
cerrar un insight, dilo en `limite` en vez de inventarlo. Si el dato es
importante, anótalo con `registrar_preguntas`.

**I2. No afirmes disposición, cita conducta.** Prohibido «estarían dispuestos
a», «les interesaría», «seguramente pagarían». Solo vale lo que **ya hicieron**
y consta en un fragmento.

> Esta es la que más se incumple y la primera que detecta un mentor. La prueba:
> si no puedes responder *«¿cómo sabes eso?»* señalando un punto concreto, no
> lo escribas.
>
> Ejemplo real de un insight que se cayó en revisión:
> *«Hay plantas dispuestas a pagar por quitarse calor de encima y, a menos de
> un kilómetro, plantas que pagan combustible para producir ese mismo calor.
> Las dos pagan. Ninguna sabe de la otra.»*
> El mentor preguntó: ¿cómo sabes que ninguna sabe de la otra? ¿cómo sabes que
> están dispuestas a pagar? ¿cómo sabes que pagan combustible? Tres
> afirmaciones sin punto que las sostuviera.
>
> La versión que sí aguanta cita conducta ya ocurrida en las dos puntas:
> *«Cabot ya opera recuperación de energía en 13 de sus plantas y fijó exportar
> el 250% de la energía que importa para 2030, por lo que la compañía ya trata
> el calor de su proceso como producto vendible; y en Kalundborg 16 empresas
> vecinas se compran corrientes térmicas por contratos bilaterales privados,
> ahorrando 4 millones de m³ al año.»*

**I3. No repitas el fragmento.** Si tu frase se puede sustituir por uno de los
puntos que conecta, no hay insight: hay una glosa.

**I4. Las dos puntas son obligatorias.** Un insight con hecho pero sin
contraparte de mercado es un dato reencuadrado. Marca explícitamente qué punto
es `HECHO` y cuál `CONTRAPARTE`.

**I5. Declara el límite. Siempre.** Qué es lo que **no** se puede afirmar con
los puntos que tienes. Un insight que no dice dónde termina su evidencia invita
a que se lo desmonten.

**I6. No rellenes por cuota.** Si el mapa solo da para dos insights sólidos,
entrega dos y explícalo.

---

## Cómo conectar

Mínimo **2** puntos; **3 o más** suele dar uno más rico, pero solo si el tercero
aporta de verdad. Pueden venir de dimensiones distintas o de la misma.

Un patrón que funciona:

- Los puntos de **Adyacencias** —mecanismos que resolvieron otras industrias—
  suelen ser la mejor `CONTRAPARTE`: son conducta probada fuera del sector.
- Los de **Su Compañía** suelen ser el `HECHO`.

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

Si citas un `fragmentoId` que no existe en ese mapa, **el insight se rechaza
entero** y el motivo vuelve en la respuesta. Es deliberado: si una de sus patas
es imaginaria, el insight no se sostiene.
