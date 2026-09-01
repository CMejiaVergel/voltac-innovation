# Plataforma de Innovacion — Voltac Systems

Software para gestionar el proceso de innovacion del **GIM Institute (IDEX)**
aplicado a retos empresariales reales. Primer reto en produccion: reuso de agua
de rechazo para **Cabot Cartagena**, en el programa **Caribe Innova 2026**.

Esta primera etapa cubre el **Mapa de Oportunidades de Negocio (BOM)** y el
agente investigador que lo llena de forma automatica para que el equipo se
dedique a revisar, corregir y decidir.

---

## Que hay hoy

| Etapa IDEX | Estado |
|---|---|
| 1 · Configurar | Brief completo: reto, problema, meta, alcance, que hacer / que evitar, intencion de innovar |
| 2 · Divergir | Mapa de Oportunidades con arrastre, edicion en linea, verificacion e historial |
| — | Agente investigador con cola de revision humana |
| — | Bibliografia y banco de preguntas pendientes |
| — | Login, proyectos privados, roles por proyecto |
| 3 · Combinar | Pendiente — Fields of Play y Conceptos de Solucion |
| 4 · Convergir | Pendiente — matriz Impacto × Fit |
| 5 · Actuar | Pendiente — plan de accion |

## Arranque local

```bash
npm install
cp .env.example .env
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"   # pegar en SESSION_SECRET
npx prisma migrate deploy
npm run seed
npm run dev
```

En `http://localhost:3000`, con el correo y la contraseña de `SEED_ADMIN_*`.
El seed carga el proyecto Cabot con sus 110 fragmentos, 9 fuentes y 7 preguntas
pendientes.

Para el agente hace falta `OPENROUTER_API_KEY` en el `.env`. Sin ella el resto
funciona igual y la pantalla del agente lo avisa.

## Despliegue

VPS con Node + PM2 + Nginx, en `innovation.voltac.com.co`. Instrucciones
completas en [`deploy/SETUP-VPS.md`](deploy/SETUP-VPS.md). Despliegues
posteriores:

```bash
cd /var/www/voltac-innovation && ./deploy/deploy.sh
```

---

## Decisiones que conviene conocer antes de tocar el codigo

### Los insights no viven en el mapa

El mapa se llena con **fragmentos crudos**. Los insights se leen despues, sobre
el mapa lleno — la agenda oficial del taller pone "Manos a la obra: BOM" antes
de "Que es un insight". Escribir la conclusion dentro del mapa hace que el
equipo deje de descubrirla y solo la confirme.

En el codigo: `Fragment` no tiene relacion con ningun modelo de insight, y el
agente tiene prohibido redactar conclusiones. Si alguien agrega esa relacion,
rompe el ejercicio. Ver `src/lib/gimi.ts` y `src/lib/agent/prompt.ts`.

### La plantilla del mapa es dato, no codigo

Filas y columnas se guardan como JSON en `MapTemplate`. Vienen dos plantillas
del sistema, y **no son intercambiables**:

- **`gimi-5x5`** — 5 dimensiones del negocio × 5 lentes. Es el mapa del taller
  de Caribe Innova (tablero fisico, `docs/`). Mapa de exploracion de Divergir.
- **`gimi-idex-5x2`** — 5 preguntas × 2 horizontes (actual / futuro con
  presupuesto ilimitado). Es el del curriculo IDEX, y del que se toma el **punto
  ancla** para construir Conceptos de Solucion en Combinar.

Ambas son GIMI oficial. La 5×5 es la predeterminada porque es la que uso el
equipo.

### Estado de verificacion por fragmento

Cada fragmento declara si esta **verificado**, **por confirmar** o es un
**supuesto**. Es lo que impide que una estimacion se lea despues como un hecho.
El codigo lo hace cumplir: si el agente marca algo como verificado sin adjuntar
URL, `src/lib/agent/run.ts` lo degrada a "por confirmar" antes de guardarlo.

Los 110 fragmentos migrados del prototipo entraron casi todos como "por
confirmar" a proposito: el prototipo no guardaba fuente por fragmento, y
marcarlos como verificados habria sido inventar respaldo.

### OpenRouter, y el modelo se elige desde la interfaz

El proveedor es OpenRouter: una clave, una factura y acceso a cientos de
modelos. El modelo se guarda **por proyecto** (`Project.agentModel`), asi que
cambiarlo no exige tocar codigo ni redesplegar.

El selector lee el catalogo vivo de OpenRouter con los precios del momento, asi
que no hay ninguna tabla de precios que se quede vieja en el repositorio.

Lo que domina el costo de una corrida no es el modelo sino la **busqueda web**,
que se cobra por resultado. Por eso es apagable por proyecto, y por eso cada
corrida guarda su costo real en USD: para decidir con datos y no con intuicion.

### La aplicacion es instalable y avisa cuando termina

Manifiesto, iconos y service worker en `public/`. En movil la navegacion es una
barra inferior de pestañas, y el mapa 5x5 se sustituye por una vista de **un
lente a la vez**: una rejilla de 25 celdas no cabe en un telefono.

El service worker **no cachea datos de la aplicacion** a proposito. El mapa
cambia a cada rato y varias personas lo editan; servir una copia vieja seria
peor que no funcionar sin conexion. Solo cachea el armazon estatico.

Las notificaciones push avisan cuando termina una corrida del agente, que es el
unico momento en que hay algo que esperar. Requieren claves VAPID; sin ellas el
resto funciona igual.

### Segunda via: Claude Code como agente, por MCP

Ademas del agente interno (OpenRouter), hay una via para que un cliente MCP
—Claude Code— actue como agente investigador contra el mismo mapa.

```
Claude Code  →  mcp/server.mjs  →  /api/agent/*  →  src/lib/agentApi.ts
```

El servidor MCP **no habla con la base de datos**. Entra por `/api/agent`, que
es la misma capa de reglas que usa la interfaz: acceso por proyecto, validacion
de coordenadas contra la plantilla, rechazo de duplicados, degradado de
`VERIFIED` sin fuente e historial obligatorio. Un cliente MCP no puede saltarse
una regla del metodo aunque quiera.

La autenticacion es por token (`ApiToken`), que **hereda los permisos del
usuario dueño**: no es una llave maestra. Se emite por CLI porque el valor en
claro se muestra una sola vez:

```bash
npm run token:crear -- --email tu@correo --label "Claude Code"
npm run token:listar
npm run token:revocar -- --prefijo vin_xxxxxxxx
```

Las reglas que sigue Claude Code viven en
`.claude/skills/agente-investigador/SKILL.md`. Son las mismas de
`src/lib/agent/prompt.ts`, que es la fuente normativa: si divergen, manda el
archivo de codigo.

### Mapas versionados

`prisma/data/bom-*.json` guarda versiones completas del mapa con fuente y
justificacion de ubicacion por fragmento. Se aplican con:

```bash
node scripts/aplicar-bom.mjs --archivo prisma/data/bom-cabot-v2.json --slug <slug> --estado ACCEPTED
```

Ese script entra por `/api/agent` a proposito: prueba el mismo camino que
recorre el MCP en vez de un atajo que no probaria nada.

### El agente propone, la persona decide

Nada de lo que produce el agente entra al mapa. Aterriza como `PROPOSED` y
espera revision: se puede editar el texto, cambiarlo de celda, ajustar su
verificacion y recien ahi aceptarlo. Se ve en la pestaña del agente y tambien
sobre el mapa, como papelito amarillo.

Lo que el agente no logra verificar no se convierte en fragmento: se escribe en
el banco de preguntas para la empresa.

### Historial que sobrevive al borrado

`FragmentRevision.fragmentId` es opcional. Al borrar un fragmento sus revisiones
no se van con el: quedan con `fragmentId` en null pero conservan texto, celda y
`mapId`. El borrado queda auditado.

### SQLite

Deliberado. El despliegue es PM2 sin Docker; SQLite quita un servicio del VPS,
hace que el entorno local funcione sin instalar nada y convierte el respaldo en
copiar un archivo. Para un equipo de este tamaño rinde de sobra.

Migrar a Postgres es cambiar `provider` en `prisma/schema.prisma` y regenerar
migraciones. Haria falta si se pasa a varias instancias o si el agente se saca
a una cola aparte.

---

## Mapa del codigo

```
prisma/schema.prisma        Modelo de datos. Empieza por aqui.
prisma/seed.ts              Plantillas, admin y proyecto Cabot.

src/lib/gimi.ts             La metodologia como constantes: IDEX, sombreros,
                            reglas que la aplicacion hace cumplir.
src/lib/templates.ts        Las dos plantillas de mapa.
src/lib/enums.ts            Estados del dominio (SQLite no tiene enums).
src/lib/auth.ts             Sesiones propias: cookie httpOnly, token hasheado.
src/lib/projects.ts         Control de acceso por proyecto.

src/lib/agent/prompt.ts     Las reglas del agente. Archivo normativo.
src/lib/agent/run.ts        Ejecucion en segundo plano y persistencia.
src/lib/agent/schema.ts     Contrato de salida validado con zod.
src/lib/agent/openrouter.ts Cliente de OpenRouter y catalogo de modelos.
src/lib/agentApi.ts         Operaciones que un agente externo puede ejecutar.
src/lib/apiToken.ts         Autenticacion por token para MCP y scripts.
src/lib/push.ts             Notificaciones push (VAPID).

mcp/server.mjs              Servidor MCP. Habla con /api/agent, no con la BD.
.claude/skills/             Reglas que sigue Claude Code como agente.
scripts/token.ts            Emitir, listar y revocar tokens.
scripts/aplicar-bom.mjs     Aplicar un mapa versionado a un proyecto.

src/app/actions/            Mutaciones. Todas verifican permiso y dejan historial.
src/components/bom/         El tablero (rejilla en escritorio, lentes en movil).
src/app/(app)/guia/         Guia de uso dentro de la aplicacion.
public/brand/               Logo, isotipo e iconos del PWA.
docs/                       Contexto original y prototipo HTML de referencia.
```

## Fuente de verdad metodologica

El material oficial de IXL Center / GIMI manda. Si algo de este repositorio lo
contradice, gana el material oficial y se corrige el codigo.
