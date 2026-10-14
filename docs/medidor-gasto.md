# Medidor de gasto: diseño técnico (Rol 5)

Última actualización: 2026-10-13. Estado: **implementado en código** (rama `rol5/medidor`), falta la prueba en vivo. Decisiones y números en `docs/costos.md`; técnicas de ahorro en `docs/reduccion-costos.md`.

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
| 3 | Límite global (`lib/globalLimit.ts`): ¿interruptor encendido? ¿el peor caso cruzaría la reserva? Si cruza, apaga el interruptor (idempotente) | `chat_disabled` / `budget_exhausted` | 0 |
| 4 | Límite del usuario (transacción sobre `rate_limits/{uid}`) | `rate_limited` | 0 |
| 5 | Leer noticias publicadas (consulta acotada + caché de 60 s) | `500 error` | 0 USD, lecturas de Firestore |
| 6 | Recuperación y respuestas sin modelo (ya existen) | `empty_question` / `too_long` / `no_news` | 0 |
| 7 | Filtro de pedidos fuera de tema | `off_topic` | 0 |
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

## Qué se guarda y qué no (privacidad)

Regla: el medidor guarda **cuánto** se usa el chat, nunca **qué** se habla en él. Esos mismos números son los que ve el tablero de admin; no hay otra fuente de datos.

### Lo que sí se guarda

| Dónde | Qué | Para qué |
|---|---|---|
| `usage/totals`, `usage/totals/days/{día}`, `usage/totals/hours/{hora}` | `spentUsd`, `inputTokens`, `outputTokens`, `questions.{camino}` (contadores) y `updatedAt` | Regla de la reserva y tablero de costos. Son sumas globales: no dicen quién preguntó |
| `rate_limits/{uid}` | `minute`, `minuteCount`, `day`, `dayCount`, `updatedAt` | Límite por usuario. El `uid` es solo el nombre del documento: sin él no se puede limitar a cada persona |
| `config/chat` | `enabled`, `limits` | Interruptor y límites; lo escribe un admin desde el portal |
| Logs de Vercel (una línea por pregunta, `route.ts`) | Camino (`path`), motivo (`reason`), cantidad de noticias citadas, tokens, costo, **largo** de la pregunta (`questionChars`) y duración (`ms`) | Evidencia de costos y depuración |

### Lo que no se guarda en ningún lado

- El texto de la pregunta.
- El texto de la respuesta del modelo.
- El prompt que se le manda al modelo (ni las noticias que se le pasaron como contexto).
- La ubicación simulada del usuario.
- El `uid` dentro de los totales o de los logs.
- Un historial de la conversación: vive solo en la memoria de la pantalla y se borra al recargar la app (`ChatPanel.tsx`, Rol 2).

**Errores en los logs:** del lado del servidor, un error nunca se escribe entero ni con su mensaje (texto libre que podría traer la pregunta, la respuesta o el prompt). Se pasa por `safeError` (`apps/mobile/lib/safeLog.ts`), que deja solo el tipo, el status HTTP y el código técnico. Pruebas: `lib/safeLog.test.ts` y las de "logs:" en `lib/meteredChat.test.ts`.

**Cómo se mantiene:** cualquier campo nuevo en estos documentos o en el log del endpoint tiene que ser un número, una fecha o un código fijo (como `path` o `reason`), nunca texto libre que venga de la persona o del modelo. Si un cambio necesita romper esta regla, se discute con el equipo antes y se anota en `docs/ciclos.md`.

## Esquema de Firestore

Todas las fechas se guardan en **UTC**. Las claves de día y de hora también van en UTC, y el tablero las muestra en hora local.

### `usage/totals` y sus subcolecciones

```
usage/totals                          ← acumulado desde el inicio
usage/totals/days/{YYYY-MM-DD}        ← por día (UTC)
usage/totals/hours/{YYYY-MM-DDTHH}    ← por hora (UTC), lo muestra el tablero
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
    disabled: number        // apagado por un admin o por la reserva
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

### `config/chat` (contrato entre la app y el portal)

```ts
type ChatConfig = {
  enabled: boolean                        // interruptor
  reserveUsd: number                      // 0–20, editable en el tablero /costos
  disabledBy: "admin" | "reserve" | null  // quién lo apagó la última vez
  updatedAt: Timestamp
}
```

- **Lectura** (igual en `apps/mobile/lib/usage.ts` y `apps/admin/lib/costs.ts`): sin documento → encendido, reserva 10. Solo un `enabled: false` explícito apaga. Una reserva que no sea un número entre 0 y 20 vale 10. `disabledBy` desconocido vale `null`. Campos de más se ignoran.
- **Quién escribe:** el tablero (admin) cambia `enabled` (con `disabledBy: "admin"` al apagar y `null` al encender) y `reserveUsd`. El endpoint **solo apaga**: si el saldo cruzaría la reserva escribe `{ enabled: false, disabledBy: "reserve" }` en una transacción, y solo si estaba encendido. Encender es siempre manual.
- **Regla de la reserva:** se permite una llamada ⇔ `20 − gasto − peor caso (USD 0,000425) ≥ reserva`. El presupuesto de USD 20 es fijo en el código e informativo.
- Los límites por usuario (5 por minuto, 20 por día, provisionales) son constantes del código (`USER_LIMITS`), no datos.
- El servidor lee `config/chat` con un caché de 30 s: apagar desde el tablero tarda como máximo eso. Cuando el propio servidor apaga por reserva, su caché se invalida en el acto.

### Variables de entorno (proyecto de Vercel de la app, solo servidor)

| Variable | Valor | Notas |
|---|---|---|
| `ANTHROPIC_API_KEY` | Key de la cuenta de Rol 5 | Nunca `NEXT_PUBLIC_` |
| `FIREBASE_SERVICE_ACCOUNT` | JSON de la cuenta de servicio | Nunca `NEXT_PUBLIC_` |
| `CHAT_THINKING` | `disabled` (por defecto) o `low` | Pensamiento del modelo (RC-08) |

`NEXT_PUBLIC_FIREBASE_PROJECT_ID` ya existe.

El presupuesto (USD 20) es fijo en el código y la reserva vive en `config/chat`: no hay variables de entorno para eso.

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
```

Las reglas reales, con la validación del formato de `config/chat`, están en `/firestore.rules`. **Antes de desplegar:** si existe un `config/chat` viejo con `limits`, borrarlo (la validación `hasOnly` rechazaría cualquier escritura sobre él).

## Módulos nuevos (`apps/mobile/lib/`)

Sigue el patrón de Rol 2: la lógica va en funciones **puras** que se prueban con `node --test`, sin red y sin gastar. Firestore y Anthropic quedan detrás de interfaces.

| Archivo | Qué hace | ¿Puro? |
|---|---|---|
| `pricing.ts` | Modelo, precios por millón de tokens, `costUsd(usage)`, `WORST_CASE_COST_USD` | Sí |
| `usage.ts` | Tipos, claves de día y hora, `parseChatConfig`, `decideReserve(gasto, reserva)`, `decideRateLimit(doc, now, limits)`, contadores a sumar según el camino | Sí |
| `usageStore.ts` | Interfaz `UsageStore` (leer el gasto total, apagar el chat por reserva, transacción de límite, registrar uso, leer config) + versión **en memoria** para pruebas y desarrollo local | Sí |
| `usageStoreFirestore.ts` | `UsageStore` con el Admin SDK | No (solo servidor) |
| `globalLimit.ts` | `checkGlobalLimit`: interruptor + reserva; única pieza que conoce el saldo; apaga el interruptor de forma idempotente | No (usa el store) |
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
| Firestore no responde al revisar el interruptor, la reserva o el límite por usuario | No se llama al modelo; `error` con mensaje claro. |
| Falla al **registrar** el uso después de la llamada | La respuesta sale igual (ya se pagó). El log de Vercel guarda los tokens para corregir a mano. |
| Anthropic responde error o `refusal` | `error` con mensaje claro; se registra lo que haya cobrado. |

### Carrera en el borde de la reserva

Revisar la reserva y registrar el gasto no ocurren en la misma transacción. Si muchas preguntas pasan el chequeo a la vez, el exceso máximo es *preguntas simultáneas × USD 0,000425* (con 20 celulares a la vez, menos de USD 0,01). El apagado sí es transaccional: aunque varias preguntas crucen la reserva al mismo tiempo, se escribe una sola vez.

## Pruebas planeadas

- `pricing.test.ts`: costo con tokens conocidos y peor caso.
- `usage.test.ts`:
  - cambio de ventana de minuto y de día;
  - límite justo en el borde;
  - reserva con y sin margen, reserva 0 y 20;
  - qué contadores suma cada camino.
- `globalLimit.test.ts`: interruptor, reserva, apagado idempotente, falla cerrada.
- `apps/admin/lib/costs.test.ts`: lectura de documentos raros, dinero, ahorro, estado del chat, campo de la reserva.
- `offTopic.test.ts`:
  - pedidos ajenos bloqueados;
  - **las preguntas de ejemplo y las 4 consultas del enunciado no se bloquean**.
- Flujo completo con `UsageStore` en memoria y un modelo falso:
  - que `budget_exhausted` y `rate_limited` nunca llamen al modelo;
  - que una llamada real sume exactamente sus tokens.
