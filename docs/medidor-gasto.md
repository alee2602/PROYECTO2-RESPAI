# Medidor de gasto: diseño técnico (Rol 5)

Última actualización: 2026-10-13. Estado: **diseño, sin implementar**. Decisiones y números en `docs/costos.md`; técnicas de ahorro en `docs/reduccion-costos.md`.

## Resumen

- **No se agrega ningún endpoint HTTP nuevo.** Todo pasa por el `POST /api/chat` que ya existe (Rol 2), en `apps/mobile`, desplegado en Vercel.
- El tablero y el interruptor del portal **leen y escriben Firestore directamente**, protegidos por las reglas `isAdmin()`. No necesitan servidor.
- Firestore gana 3 grupos de documentos. Solo el servidor escribe los contadores, con el Firebase Admin SDK.

Menos endpoints significa menos superficie que proteger. La autorización de admin ya la resuelven las reglas de Firestore, igual que en el resto del portal.

## Endpoint `POST /api/chat`: qué cambia

Se mantiene el mismo método, la misma ruta, el mismo cuerpo `{ question, location }` y el mismo header `Authorization: Bearer <ID token>`. Lo que cambia es el orden de pasos dentro del endpoint:

| # | Paso | Si falla | Costo |
|---|---|---|---|
| 1 | Verificar el ID token (Admin SDK, `verifyIdToken`) | `401 unauthenticated` | 0 |
| 2 | Validar el cuerpo (`parseChatRequest`, ya existe) | `400 error` | 0 |
| 3 | Leer `config/chat`: ¿chat encendido? | `chat_disabled` | 0 |
| 4 | Límite del usuario (transacción sobre `rate_limits/{uid}`) | `rate_limited` | 0 |
| 5 | Leer noticias publicadas (consulta acotada + caché de 60 s) | `500 error` | 0 USD, lecturas de Firestore |
| 6 | Recuperación y respuestas sin modelo (ya existen) | `empty_question` / `too_long` / `no_news` | 0 |
| 7 | Filtro de pedidos fuera de tema | `off_topic` | 0 |
| 8 | Tope total y freno por hora (leer totales) | `budget_exhausted` | 0 |
| 9 | Llamar a Haiku 5.5 | `500 error` | El de la llamada |
| 10 | Registrar el uso: incrementos en los totales | Se registra en el log, la respuesta sale igual | 0 |

**Todas** las preguntas que pasan el paso 2 suman a los contadores con su camino, incluidas las que cuestan 0. Así el tablero puede mostrar el ahorro.

### Cambios en el contrato (`lib/chat.ts`, de Rol 2: se proponen, no se cambian en silencio)

`NoAnswerReason` suma tres motivos, cada uno con su texto fijo en `NO_ANSWER_TEXT`:

| Motivo | Texto propuesto |
|---|---|
| `rate_limited` | "Hiciste muchas preguntas seguidas. Espera un momento y vuelve a intentar; mientras tanto puedes leer tu portada." |
| `off_topic` | "Solo puedo responder sobre las noticias publicadas en la app. Prueba con una de las preguntas de ejemplo." |
| `chat_disabled` | "El chat está pausado por ahora. Puedes leer todas las noticias en tu portada." |

La pantalla (`ChatPanel.tsx`) ya muestra cualquier `no_answer` como mensaje claro, así que no necesita cambios. Opcional: mostrar el enlace a la portada también en estos casos.

## Esquema de Firestore

Todas las fechas se guardan en **UTC**. Las claves de día y de hora también van en UTC, y el tablero las muestra en hora local.

### `usage/totals` y sus subcolecciones

```
usage/totals                          ← acumulado desde el inicio
usage/totals/days/{YYYY-MM-DD}        ← por día (UTC)
usage/totals/hours/{YYYY-MM-DDTHH}    ← por hora (UTC), lo usa el freno por hora
```

Los tres tipos de documento tienen la misma forma:

```ts
type UsageCounters = {
  spentUsd: number          // costo calculado con lib/pricing.ts
  inputTokens: number       // usage.input_tokens real de la API
  outputTokens: number      // usage.output_tokens real (incluye el pensamiento)
  questions: {              // preguntas por camino
    model: number           // llamó al modelo (lo único que cuesta)
    no_model: number        // vacía, saludo, muy larga o sin noticias
    off_topic: number
    rate_limited: number
    budget_blocked: number
    disabled: number
    simulated: number       // sin API key: modo de prueba
    error: number
  }
  updatedAt: Timestamp
}
```

- Se escribe solo con `FieldValue.increment(...)`, en un `batch` que toca los 3 documentos a la vez. Es atómico y varios celulares a la vez no se pisan.
- No se guarda **nada** de la pregunta ni del usuario: ni el texto, ni el `uid`, ni la ubicación.
- Tamaño: un documento por día y uno por hora. Para una entrega a 3 días son menos de 100 documentos.

### `rate_limits/{uid}`

```ts
type RateLimitDoc = {
  minute: string        // ventana actual "YYYY-MM-DDTHH:MM" (UTC)
  minuteCount: number
  day: string           // "YYYY-MM-DD" (UTC)
  dayCount: number
  updatedAt: Timestamp
}
```

Usa **ventanas fijas**: si la ventana guardada no es la actual, el contador vuelve a 0. Leer, revisar y sumar ocurre dentro de una **transacción**, así dos preguntas simultáneas del mismo usuario no pueden pasar las dos el límite. Guarda solo contadores, sin el contenido de las preguntas.

### `config/chat`

```ts
type ChatConfig = {
  enabled: boolean                 // interruptor de apagado
  limits?: {                       // opcional: si falta, se usan los valores del código
    perMinute?: number
    perDay?: number
    hourlyUsd?: number
  }
  updatedAt: Timestamp
  updatedBy: string                // correo del admin que lo cambió
}
```

Con `limits` en datos, los valores se pueden ajustar durante un ensayo sin volver a desplegar. Siguen siendo **pregunta abierta** (`docs/costos.md`). Si el documento no existe, el chat queda encendido y usa los límites del código.

El servidor lo lee con un caché de unos 30 segundos, así apagar el chat tarda como máximo ese tiempo en hacer efecto.

### Variables de entorno (proyecto de Vercel de la app, solo servidor)

| Variable | Valor | Notas |
|---|---|---|
| `ANTHROPIC_API_KEY` | Key de la cuenta de Rol 5 | Nunca `NEXT_PUBLIC_` |
| `FIREBASE_SERVICE_ACCOUNT` | JSON de la cuenta de servicio | Nunca `NEXT_PUBLIC_` |
| `BUDGET_USD` | `20` | Presupuesto |
| `RESERVE_USD` | `10` | Reserva para la demo; tope = 20 − 10 |

`NEXT_PUBLIC_FIREBASE_PROJECT_ID` ya existe.

## Borrador de reglas de Firestore (lo revisa y despliega Rol 4)

```
// Medidor de gasto (Rol 5). Lo escribe solo el servidor con el Admin SDK,
// que no pasa por estas reglas. Desde el cliente: solo admins leen.
match /usage/{document=**} {
  allow read: if isAdmin();
  allow write: if false;
}
match /rate_limits/{userId} {
  allow read: if isAdmin();
  allow write: if false;
}
// Interruptor y límites del chat: los cambia un admin desde el portal.
match /config/chat {
  allow read, write: if isAdmin();
}
```

Opcional: validar en las reglas que `config/chat` solo tenga los campos esperados.

## Módulos nuevos (`apps/mobile/lib/`)

Sigue el patrón de Rol 2: la lógica va en funciones **puras** que se prueban con `node --test`, sin red y sin gastar. Firestore y Anthropic quedan detrás de interfaces.

| Archivo | Qué hace | ¿Puro? |
|---|---|---|
| `pricing.ts` | Modelo, precios por millón de tokens, `costUsd(usage)`, `WORST_CASE_COST_USD` | Sí |
| `usage.ts` | Tipos, claves de día y hora, `decideBudget(totals, hour, config)`, `decideRateLimit(doc, now, limits)`, contadores a sumar según el camino | Sí |
| `usageStore.ts` | Interfaz `UsageStore` (leer totales y hora, transacción de límite, registrar uso, leer config) + versión **en memoria** para pruebas y desarrollo local | Sí |
| `usageStoreFirestore.ts` | `UsageStore` con el Admin SDK | No (solo servidor) |
| `offTopic.ts` | Filtro de pedidos fuera de tema | Sí |
| `anthropic.ts` | La función `generate` (tipo `Generate` de `chatPipeline.ts`) con el SDK oficial | No (solo servidor) |
| `serverAuth.ts` | Inicializa el Admin SDK y verifica el ID token | No (solo servidor) |

Dependencias nuevas, solo de servidor: `@anthropic-ai/sdk` y `firebase-admin`.

`route.ts` (Rol 2) cambia unas pocas líneas: arma el `UsageStore` y el `generate` y llama a los pasos de arriba. La orquestación puede vivir en una función pura nueva, por ejemplo `meteredAnswer` en `usage.ts`, que envuelve a `answerQuestion` sin modificarla.

## Modos de falla

Regla general: **ante la duda, no se llama al modelo.** Fallar cerrado protege el presupuesto, y el chat sigue respondiendo con un mensaje claro.

| Situación | Qué pasa |
|---|---|
| Falta `ANTHROPIC_API_KEY` | Modo de prueba, que ya existe (`generate = null`). Se cuenta como `simulated`. |
| Falta `FIREBASE_SERVICE_ACCOUNT` | **No se llama al modelo** (sin medidor no hay tope), se responde en modo de prueba y queda un aviso en el log. En local, `UsageStore` en memoria. |
| Firestore no responde al revisar límites o tope | No se llama al modelo; `error` con mensaje claro. |
| Falla al **registrar** el uso después de la llamada | La respuesta sale igual (ya se pagó). El log de Vercel guarda los tokens para corregir a mano. |
| Anthropic responde error o `refusal` | `error` con mensaje claro; se registra lo que haya cobrado. |

### Carrera en el tope total

Revisar el tope y registrar el gasto no ocurren en la misma transacción. Hacerlo transaccional serializaría todo el chat. Si muchas preguntas pasan el chequeo al mismo tiempo, el exceso máximo es *preguntas simultáneas × USD 0,000425*: con 20 celulares a la vez, menos de USD 0,01. Por eso el chequeo usa `gasto + peor caso > tope` y no hace falta más precisión.

## Pruebas planeadas

- `pricing.test.ts`: costo con tokens conocidos y peor caso.
- `usage.test.ts`:
  - cambio de ventana de minuto y de día;
  - límite justo en el borde;
  - tope con y sin margen;
  - freno por hora;
  - qué contadores suma cada camino.
- `offTopic.test.ts`:
  - pedidos ajenos bloqueados;
  - **las preguntas de ejemplo y las 4 consultas del enunciado no se bloquean**.
- Flujo completo con `UsageStore` en memoria y un modelo falso:
  - que `budget_exhausted` y `rate_limited` nunca llamen al modelo;
  - que una llamada real sume exactamente sus tokens.
