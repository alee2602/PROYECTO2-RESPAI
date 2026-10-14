# Medidor de gasto y tope — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Objetivo:** que cada pregunta al chat quede medida (tokens, costo, camino) en Firestore y que el modelo nunca se llame si el chat está apagado, el usuario pasó su límite, se pasó el freno por hora o el gasto llegaría al tope de USD 10.

**Arquitectura:** la lógica es pura y se prueba con `node --test` sin red: precios, decisiones de tope y de límite, y una orquestación `meteredAnswer` que envuelve a `answerQuestion` (Rol 2) sin modificarla. Firestore queda detrás de una interfaz `UsageStore` (versión en memoria para pruebas, versión Admin SDK para producción) y Anthropic detrás del tipo `Generate` que ya existe. El endpoint `POST /api/chat` solo cambia unas líneas para conectar las piezas.

**Stack:** Next.js 16 (API route, runtime Node), TypeScript, `node --test` con `--experimental-strip-types` (Node 24), `firebase-admin`, `@anthropic-ai/sdk`.

**Spec:** `docs/medidor-gasto.md` (diseño técnico), `docs/costos.md` (decisiones y números), `docs/reduccion-costos.md` (RC-15 a RC-20).

**Fuera de este plan** (planes siguientes): tablero `/costos` del portal; filtro fuera de tema (RC-14); contexto según la intención (RC-09); consulta acotada y caché de noticias (RC-10, RC-11); regla de propósito cerrado en el prompt (RC-13); banco de pruebas del pensamiento (RC-08, necesita la API key).

## Restricciones globales

- **Commits:** Claude no hace commits ni agrega coautoría (CLAUDE.md, sección 11). Cada paso "Commit" es: avisar al usuario, que revisa y hace el commit con el mensaje sugerido.
- **Secretos:** `ANTHROPIC_API_KEY` y `FIREBASE_SERVICE_ACCOUNT` solo en el servidor. Nunca con prefijo `NEXT_PUBLIC_`, nunca en el repo.
- **Modelo:** `claude-haiku-5-5`. Precio: USD 0,10 por millón de tokens de entrada y USD 0,50 por millón de salida.
- **Presupuesto:** `BUDGET_USD=20`, `RESERVE_USD=10`. Tope = 20 − 10 = USD 10.
- **Peor caso por llamada:** 2.500 tokens de entrada + 350 de salida = USD 0,000425.
- **Falla cerrada:** ante cualquier duda (configuración inválida, Firestore caído) **no se llama al modelo** y se responde un mensaje claro.
- **Privacidad:** no se guarda el texto de la pregunta, ni el `uid` en los totales, ni la ubicación.
- **Claves de tiempo en UTC:** día `YYYY-MM-DD`, hora `YYYY-MM-DDTHH`, minuto `YYYY-MM-DDTHH:MM`.
- **Límites por defecto PROVISIONALES:** 5 preguntas por minuto, 20 por día y USD 1 por hora (20 por día y USD 1 por hora acordados con el usuario el 2026-10-13; pueden cambiar). Son pregunta abierta (`docs/costos.md`) y se marcan así en el código.
- **Archivos de otros roles:**
  - `lib/chat.ts`, `components/ChatPanel.tsx` y `app/api/chat/route.ts` son de Rol 2.
  - `firestore.rules` es de Rol 4.

  Los cambios se hacen en el PR y se avisan; no se hacen en silencio.
- **Importaciones dentro de `lib/`:** rutas relativas con extensión `.ts` (`./usage.ts`), como el resto de `lib/`, para que funcionen en `node --test`.
- **Mensajes para la persona:** en español, sin detalles técnicos.

## Review Focus

1. **Mismo usuario, varias preguntas a la vez en el borde del límite:** solo pasan exactamente las permitidas. Prueba en la Tarea 3 (`Promise.all` sobre la versión en memoria). En Firestore lo garantiza la transacción de la Tarea 7.
2. **Cambio de minuto o de día (medianoche UTC):** el contador vuelve a 0 y no bloquea al día siguiente. Pruebas en la Tarea 2.
3. **El modelo cobró pero no sirvió** (`refusal`, respuesta vacía): el costo igual se registra. Pruebas en las Tareas 5 y 6.
4. **Firestore caído antes de llamar al modelo:** no se llama al modelo, no se leen noticias y la persona ve un mensaje claro. Pruebas en la Tarea 5.
5. **Variables de entorno mal puestas** (falta `BUDGET_USD`, valor no numérico, reserva ≥ presupuesto): nunca se llama al modelo y el chat sigue en modo de prueba. Pruebas en las Tareas 2 y 5.

---

## Mapa de archivos

| Archivo | Responsabilidad | Tarea |
|---|---|---|
| `apps/mobile/lib/pricing.ts` (nuevo) | Modelo, precios, `costUsd`, peor caso | 1 |
| `apps/mobile/lib/usage.ts` (nuevo) | Tipos y decisiones puras: contadores, claves UTC, config, presupuesto, límite, `PaidModelError`, `incrementFields` | 2 |
| `apps/mobile/lib/usageStore.ts` (nuevo) | Interfaz `UsageStore` + `MemoryUsageStore` | 3 |
| `apps/mobile/lib/chat.ts` (Rol 2) | Motivos nuevos `rate_limited`, `chat_disabled`, `off_topic` y sus textos | 4 |
| `apps/mobile/components/ChatPanel.tsx` (Rol 2) | Enlace a la portada también en los motivos nuevos | 4 |
| `apps/mobile/lib/meteredChat.ts` (nuevo) | Orquestación `meteredAnswer` | 5 |
| `apps/mobile/lib/anthropic.ts` (nuevo) | `Generate` con el SDK de Anthropic | 6 |
| `apps/mobile/lib/serverAuth.ts` (nuevo) | Admin SDK: iniciar y verificar el token | 7 |
| `apps/mobile/lib/usageStoreFirestore.ts` (nuevo) | `UsageStore` sobre Firestore | 7 |
| `apps/mobile/app/api/chat/route.ts` (Rol 2) | Conectar las piezas | 8 |
| `firestore.rules` (Rol 4) | Reglas propuestas | 9 |
| `apps/mobile/.env.example`, `docs/*` | Variables y documentación | 9 |

---

### Tarea 0: Preparar el entorno

**Archivos:** ninguno.

- [ ] **Paso 1: Instalar dependencias** (desde la raíz del repo)

Run: `npm install`
Esperado: termina sin errores y crea `node_modules/`.

- [ ] **Paso 2: Correr las pruebas existentes como línea base**

Run: `npm test -w @respai/mobile`
Esperado: todas pasan (86 al 2026-10-13). Si alguna falla antes de tocar nada, se anota y se avisa: no es parte de este plan.

---

### Tarea 1: Precios y costo por llamada (`pricing.ts`)

**Archivos:**
- Crear: `apps/mobile/lib/pricing.ts`
- Prueba: `apps/mobile/lib/pricing.test.ts`

**Interfaces:**
- Usa: `ModelUsage` de `./chatPipeline.ts` (`{ inputTokens: number; outputTokens: number }`) y `PROMPT_LIMITS.maxOutputTokens` (350) de `./prompt.ts`.
- Produce:
  - `CHAT_MODEL: "claude-haiku-5-5"`
  - `PRICE_USD_PER_MTOK: { input: 0.1; output: 0.5 }`
  - `WORST_CASE_INPUT_TOKENS: 2500`
  - `costUsd(usage: ModelUsage): number`
  - `WORST_CASE_COST_USD: number`

- [ ] **Paso 1: Escribir la prueba que falla**

`apps/mobile/lib/pricing.test.ts`:

```ts
import { test } from "node:test"
import assert from "node:assert/strict"
import { CHAT_MODEL, WORST_CASE_COST_USD, costUsd } from "./pricing.ts"

const close = (a: number, b: number) => Math.abs(a - b) < 1e-12

test("modelo del chat: Haiku 5.5", () => {
  assert.equal(CHAT_MODEL, "claude-haiku-5-5")
})

test("costo: USD 0,10 por millón de entrada y 0,50 por millón de salida", () => {
  assert.ok(close(costUsd({ inputTokens: 1_000_000, outputTokens: 0 }), 0.1))
  assert.ok(close(costUsd({ inputTokens: 0, outputTokens: 1_000_000 }), 0.5))
  assert.ok(close(costUsd({ inputTokens: 900, outputTokens: 80 }), 0.00013))
})

test("peor caso por llamada: 2.500 de entrada + 350 de salida = USD 0,000425", () => {
  assert.ok(close(WORST_CASE_COST_USD, 0.000425))
})
```

- [ ] **Paso 2: Correr la prueba y ver que falla**

Run (desde `apps/mobile`): `node --experimental-strip-types --test lib/pricing.test.ts`
Esperado: FALLA con `Cannot find module` (no existe `pricing.ts`).

- [ ] **Paso 3: Implementar**

`apps/mobile/lib/pricing.ts`:

```ts
import type { ModelUsage } from "./chatPipeline.ts"
import { PROMPT_LIMITS } from "./prompt.ts"

// ---------------------------------------------------------------------------
// Precios del modelo del chat (Rol 5). Fuente: precios oficiales de Anthropic
// para prompts de hasta 100.000 tokens. Si cambia el modelo, cambiar esto y
// anotarlo en docs/costos.md. Módulo puro.
// ---------------------------------------------------------------------------

export const CHAT_MODEL = "claude-haiku-5-5"

export const PRICE_USD_PER_MTOK = { input: 0.1, output: 0.5 } as const

// Tope de entrada que fija prompt.test.ts ("contexto corto", docs/chat.md paso 4).
export const WORST_CASE_INPUT_TOKENS = 2500

export function costUsd(usage: ModelUsage): number {
  return (
    (usage.inputTokens * PRICE_USD_PER_MTOK.input + usage.outputTokens * PRICE_USD_PER_MTOK.output) / 1_000_000
  )
}

// Lo máximo que puede costar UNA llamada: max_tokens incluye el pensamiento,
// así que la salida nunca pasa de PROMPT_LIMITS.maxOutputTokens.
export const WORST_CASE_COST_USD = costUsd({
  inputTokens: WORST_CASE_INPUT_TOKENS,
  outputTokens: PROMPT_LIMITS.maxOutputTokens,
})
```

- [ ] **Paso 4: Correr la prueba y ver que pasa**

Run: `node --experimental-strip-types --test lib/pricing.test.ts`
Esperado: 3 pruebas pasan.

- [ ] **Paso 5: Commit (lo hace el usuario)**

Mensaje sugerido: `feat(rol5): precios de Haiku 5.5 y costo por llamada`

---

### Tarea 2: Decisiones puras del medidor (`usage.ts`)

**Archivos:**
- Crear: `apps/mobile/lib/usage.ts`
- Prueba: `apps/mobile/lib/usage.test.ts`

**Interfaces:**
- Usa: `ModelUsage` (Tarea 1), `costUsd` y `WORST_CASE_COST_USD` de `./pricing.ts`.
- Produce:
  - `USAGE_PATHS`, `type UsagePath = "model" | "no_model" | "off_topic" | "rate_limited" | "budget_blocked" | "disabled" | "simulated" | "error"`
  - `type UsageCounters = { spentUsd; inputTokens; outputTokens; questions: Record<UsagePath, number> }`
  - `emptyCounters()`, `type UsageRecord = { path: UsagePath; usage?: ModelUsage }`
  - `countersDelta(rec): UsageCounters`, `addCounters(a, b): UsageCounters`
  - `incrementFields<T>(delta: UsageCounters, inc: (n: number) => T): Record<string, unknown>`
  - `dayKey(d)`, `hourKey(d)`, `minuteKey(d)` (UTC)
  - `type ChatLimits = { perMinute; perDay; hourlyUsd }`, `DEFAULT_LIMITS`
  - `type ChatConfig = { enabled: boolean; limits: ChatLimits }`, `DEFAULT_CONFIG`, `parseChatConfig(raw: unknown): ChatConfig`
  - `type BudgetSettings = { budgetUsd; reserveUsd }`, `parseBudgetEnv(env): BudgetSettings | null`, `capUsd(b)`
  - `type Spend = { totalUsd: number; hourUsd: number }`
  - `type BudgetDecision = { allowed: true } | { allowed: false; why: "total" | "hourly" }`, `decideBudget(spend, budget, limits)`
  - `type RateLimitState = { minute; minuteCount; day; dayCount }`, `parseRateLimitState(raw): RateLimitState | null`
  - `decideRateLimit(prev, now, limits): { allowed: boolean; next: RateLimitState }`
  - `class PaidModelError extends Error { usage: ModelUsage }`

- [ ] **Paso 1: Escribir las pruebas que fallan**

`apps/mobile/lib/usage.test.ts`:

```ts
import { test } from "node:test"
import assert from "node:assert/strict"
import { WORST_CASE_COST_USD, costUsd } from "./pricing.ts"
import {
  DEFAULT_CONFIG,
  DEFAULT_LIMITS,
  PaidModelError,
  addCounters,
  countersDelta,
  dayKey,
  decideBudget,
  decideRateLimit,
  emptyCounters,
  hourKey,
  incrementFields,
  minuteKey,
  parseBudgetEnv,
  parseChatConfig,
  parseRateLimitState,
} from "./usage.ts"

const LIMITS = { perMinute: 2, perDay: 3, hourlyUsd: 1 }
const BUDGET = { budgetUsd: 20, reserveUsd: 10 }

// --- Claves de tiempo (UTC) ------------------------------------------------

test("claves de día, hora y minuto en UTC", () => {
  const d = new Date("2026-10-13T23:59:30-06:00") // Guatemala → 2026-10-14 05:59 UTC
  assert.equal(dayKey(d), "2026-10-14")
  assert.equal(hourKey(d), "2026-10-14T05")
  assert.equal(minuteKey(d), "2026-10-14T05:59")
})

// --- Contadores ------------------------------------------------------------

test("llamada al modelo: suma tokens, costo y una pregunta en 'model'", () => {
  const usage = { inputTokens: 900, outputTokens: 80 }
  const d = countersDelta({ path: "model", usage })
  assert.equal(d.inputTokens, 900)
  assert.equal(d.outputTokens, 80)
  assert.equal(d.spentUsd, costUsd(usage))
  assert.equal(d.questions.model, 1)
  assert.equal(d.questions.no_model, 0)
})

test("pregunta sin modelo: cuenta la pregunta pero cuesta 0", () => {
  const d = countersDelta({ path: "no_model" })
  assert.equal(d.spentUsd, 0)
  assert.equal(d.inputTokens, 0)
  assert.equal(d.questions.no_model, 1)
})

test("addCounters suma campo por campo", () => {
  const a = countersDelta({ path: "model", usage: { inputTokens: 10, outputTokens: 5 } })
  const b = countersDelta({ path: "rate_limited" })
  const s = addCounters(addCounters(emptyCounters(), a), b)
  assert.equal(s.inputTokens, 10)
  assert.equal(s.questions.model, 1)
  assert.equal(s.questions.rate_limited, 1)
})

test("incrementFields: solo incluye los caminos con pregunta, con la función dada", () => {
  const d = countersDelta({ path: "model", usage: { inputTokens: 10, outputTokens: 5 } })
  const f = incrementFields(d, (n) => ({ inc: n }))
  assert.deepEqual(f.inputTokens, { inc: 10 })
  assert.deepEqual(f.questions, { model: { inc: 1 } })
})

// --- Config del chat ---------------------------------------------------------

test("config: sin documento → encendido con límites por defecto", () => {
  assert.deepEqual(parseChatConfig(null), DEFAULT_CONFIG)
  assert.deepEqual(parseChatConfig(undefined), DEFAULT_CONFIG)
})

test("config: solo un false explícito apaga el chat", () => {
  assert.equal(parseChatConfig({ enabled: false }).enabled, false)
  assert.equal(parseChatConfig({}).enabled, true)
  assert.equal(parseChatConfig({ enabled: "false" }).enabled, true)
})

test("config: límites inválidos caen al valor por defecto, los válidos se respetan", () => {
  const c = parseChatConfig({ limits: { perMinute: 0, perDay: -1, hourlyUsd: 0.5 } })
  assert.equal(c.limits.perMinute, DEFAULT_LIMITS.perMinute)
  assert.equal(c.limits.perDay, DEFAULT_LIMITS.perDay)
  assert.equal(c.limits.hourlyUsd, 0.5)
})

// --- Presupuesto (Review Focus 5) --------------------------------------------

test("presupuesto: valores válidos", () => {
  assert.deepEqual(parseBudgetEnv({ BUDGET_USD: "20", RESERVE_USD: "10" }), BUDGET)
})

test("presupuesto mal configurado → null (no se llama al modelo)", () => {
  assert.equal(parseBudgetEnv({}), null)
  assert.equal(parseBudgetEnv({ BUDGET_USD: "20" }), null)
  assert.equal(parseBudgetEnv({ BUDGET_USD: "veinte", RESERVE_USD: "10" }), null)
  assert.equal(parseBudgetEnv({ BUDGET_USD: "20", RESERVE_USD: "20" }), null)
  assert.equal(parseBudgetEnv({ BUDGET_USD: "20", RESERVE_USD: "-1" }), null)
  assert.equal(parseBudgetEnv({ BUDGET_USD: "", RESERVE_USD: "" }), null)
})

test("tope total: bloquea si gasto + peor caso supera USD 10", () => {
  const hourUsd = 0
  assert.deepEqual(decideBudget({ totalUsd: 10 - WORST_CASE_COST_USD / 2, hourUsd }, BUDGET, LIMITS), {
    allowed: false,
    why: "total",
  })
  assert.deepEqual(decideBudget({ totalUsd: 10 - 2 * WORST_CASE_COST_USD, hourUsd }, BUDGET, LIMITS), {
    allowed: true,
  })
})

test("freno por hora: bloquea si el gasto de la hora + peor caso supera el límite", () => {
  assert.deepEqual(decideBudget({ totalUsd: 0, hourUsd: 1 }, BUDGET, LIMITS), { allowed: false, why: "hourly" })
  assert.deepEqual(decideBudget({ totalUsd: 0, hourUsd: 0.5 }, BUDGET, LIMITS), { allowed: true })
})

// --- Límite por usuario (Review Focus 2) -------------------------------------

const at = (iso: string) => new Date(iso)

test("límite: la primera pregunta pasa y empieza a contar", () => {
  const r = decideRateLimit(null, at("2026-10-13T15:04:10Z"), LIMITS)
  assert.equal(r.allowed, true)
  assert.deepEqual(r.next, { minute: "2026-10-13T15:04", minuteCount: 1, day: "2026-10-13", dayCount: 1 })
})

test("límite por minuto: la pregunta extra se bloquea y no suma", () => {
  const prev = { minute: "2026-10-13T15:04", minuteCount: 2, day: "2026-10-13", dayCount: 2 }
  const r = decideRateLimit(prev, at("2026-10-13T15:04:50Z"), LIMITS)
  assert.equal(r.allowed, false)
  assert.equal(r.next.minuteCount, 2)
})

test("cambio de minuto: el contador del minuto vuelve a 0, el del día sigue", () => {
  const prev = { minute: "2026-10-13T15:04", minuteCount: 2, day: "2026-10-13", dayCount: 2 }
  const r = decideRateLimit(prev, at("2026-10-13T15:05:00Z"), LIMITS)
  assert.equal(r.allowed, true)
  assert.deepEqual(r.next, { minute: "2026-10-13T15:05", minuteCount: 1, day: "2026-10-13", dayCount: 3 })
})

test("límite por día: bloquea aunque el minuto sea nuevo", () => {
  const prev = { minute: "2026-10-13T15:04", minuteCount: 1, day: "2026-10-13", dayCount: 3 }
  assert.equal(decideRateLimit(prev, at("2026-10-13T18:00:00Z"), LIMITS).allowed, false)
})

test("medianoche UTC: el día nuevo vuelve a permitir", () => {
  const prev = { minute: "2026-10-13T23:59", minuteCount: 2, day: "2026-10-13", dayCount: 3 }
  const r = decideRateLimit(prev, at("2026-10-14T00:00:01Z"), LIMITS)
  assert.equal(r.allowed, true)
  assert.deepEqual(r.next, { minute: "2026-10-14T00:00", minuteCount: 1, day: "2026-10-14", dayCount: 1 })
})

test("parseRateLimitState: acepta el documento válido y rechaza basura", () => {
  const ok = { minute: "2026-10-13T15:04", minuteCount: 1, day: "2026-10-13", dayCount: 1, updatedAt: "x" }
  assert.deepEqual(parseRateLimitState(ok), { minute: "2026-10-13T15:04", minuteCount: 1, day: "2026-10-13", dayCount: 1 })
  assert.equal(parseRateLimitState(null), null)
  assert.equal(parseRateLimitState({ minute: 5 }), null)
})

test("PaidModelError guarda el uso cobrado", () => {
  const e = new PaidModelError("refusal", { inputTokens: 1, outputTokens: 2 })
  assert.ok(e instanceof Error)
  assert.deepEqual(e.usage, { inputTokens: 1, outputTokens: 2 })
})
```

- [ ] **Paso 2: Correr las pruebas y ver que fallan**

Run: `node --experimental-strip-types --test lib/usage.test.ts`
Esperado: FALLA con `Cannot find module` (no existe `usage.ts`).

- [ ] **Paso 3: Implementar**

`apps/mobile/lib/usage.ts`:

```ts
import type { ModelUsage } from "./chatPipeline.ts"
import { WORST_CASE_COST_USD, costUsd } from "./pricing.ts"

// ---------------------------------------------------------------------------
// Medidor de gasto (Rol 5): tipos y decisiones PURAS (sin Firestore, sin red).
// Diseño: docs/medidor-gasto.md. Todas las claves de tiempo van en UTC.
// ---------------------------------------------------------------------------

// Qué camino tomó una pregunta. Solo "model" cuesta dinero.
export const USAGE_PATHS = [
  "model",
  "no_model",
  "off_topic",
  "rate_limited",
  "budget_blocked",
  "disabled",
  "simulated",
  "error",
] as const
export type UsagePath = (typeof USAGE_PATHS)[number]

export type UsageCounters = {
  spentUsd: number
  inputTokens: number
  outputTokens: number
  questions: Record<UsagePath, number>
}

export function emptyCounters(): UsageCounters {
  const questions = Object.fromEntries(USAGE_PATHS.map((p) => [p, 0])) as Record<UsagePath, number>
  return { spentUsd: 0, inputTokens: 0, outputTokens: 0, questions }
}

export type UsageRecord = { path: UsagePath; usage?: ModelUsage }

// Lo que suma UNA pregunta. Sin texto de la pregunta ni datos del usuario.
export function countersDelta(rec: UsageRecord): UsageCounters {
  const d = emptyCounters()
  d.questions[rec.path] = 1
  if (rec.usage) {
    d.inputTokens = rec.usage.inputTokens
    d.outputTokens = rec.usage.outputTokens
    d.spentUsd = costUsd(rec.usage)
  }
  return d
}

export function addCounters(a: UsageCounters, b: UsageCounters): UsageCounters {
  const questions = { ...a.questions }
  for (const p of USAGE_PATHS) questions[p] += b.questions[p]
  return {
    spentUsd: a.spentUsd + b.spentUsd,
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    questions,
  }
}

// Documento de incrementos para Firestore. `inc` es FieldValue.increment en
// producción; acá se recibe como parámetro para poder probarlo sin Firebase.
export function incrementFields<T>(delta: UsageCounters, inc: (n: number) => T): Record<string, unknown> {
  const questions: Record<string, T> = {}
  for (const p of USAGE_PATHS) if (delta.questions[p]) questions[p] = inc(delta.questions[p])
  return {
    spentUsd: inc(delta.spentUsd),
    inputTokens: inc(delta.inputTokens),
    outputTokens: inc(delta.outputTokens),
    questions,
  }
}

// --- Claves de tiempo (UTC) ------------------------------------------------

export const dayKey = (d: Date) => d.toISOString().slice(0, 10) // YYYY-MM-DD
export const hourKey = (d: Date) => d.toISOString().slice(0, 13) // YYYY-MM-DDTHH
export const minuteKey = (d: Date) => d.toISOString().slice(0, 16) // YYYY-MM-DDTHH:MM

// --- Config del chat (documento config/chat) --------------------------------

export type ChatLimits = {
  perMinute: number // preguntas por usuario por minuto (ráfaga)
  perDay: number // preguntas por usuario por día
  hourlyUsd: number // freno global: gasto máximo por hora
}

// PROVISIONALES: los valores son pregunta abierta (docs/costos.md). Se pueden
// cambiar sin desplegar desde config/chat.limits.
export const DEFAULT_LIMITS: ChatLimits = { perMinute: 5, perDay: 20, hourlyUsd: 1 }

export type ChatConfig = { enabled: boolean; limits: ChatLimits }

export const DEFAULT_CONFIG: ChatConfig = { enabled: true, limits: DEFAULT_LIMITS }

const isPositive = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v > 0

// Sin documento, el chat está encendido con los límites por defecto. Solo un
// `enabled: false` explícito lo apaga; un límite inválido usa el de defecto.
export function parseChatConfig(raw: unknown): ChatConfig {
  if (!raw || typeof raw !== "object") return DEFAULT_CONFIG
  const r = raw as { enabled?: unknown; limits?: unknown }
  const l = (r.limits && typeof r.limits === "object" ? r.limits : {}) as Record<string, unknown>
  return {
    enabled: r.enabled !== false,
    limits: {
      perMinute: isPositive(l.perMinute) ? l.perMinute : DEFAULT_LIMITS.perMinute,
      perDay: isPositive(l.perDay) ? l.perDay : DEFAULT_LIMITS.perDay,
      hourlyUsd: isPositive(l.hourlyUsd) ? l.hourlyUsd : DEFAULT_LIMITS.hourlyUsd,
    },
  }
}

// --- Presupuesto y tope -------------------------------------------------------

export type BudgetSettings = { budgetUsd: number; reserveUsd: number }

// De las variables de entorno BUDGET_USD y RESERVE_USD. Si algo está mal,
// devuelve null y el endpoint NO llama al modelo (falla cerrada).
export function parseBudgetEnv(env: Record<string, string | undefined>): BudgetSettings | null {
  if (!env.BUDGET_USD || !env.RESERVE_USD) return null
  const budgetUsd = Number(env.BUDGET_USD)
  const reserveUsd = Number(env.RESERVE_USD)
  if (!Number.isFinite(budgetUsd) || !Number.isFinite(reserveUsd)) return null
  if (budgetUsd <= 0 || reserveUsd < 0 || reserveUsd >= budgetUsd) return null
  return { budgetUsd, reserveUsd }
}

// Lo que se puede gastar antes de tocar la reserva de la demo.
export const capUsd = (b: BudgetSettings) => b.budgetUsd - b.reserveUsd

export type Spend = { totalUsd: number; hourUsd: number }

export type BudgetDecision = { allowed: true } | { allowed: false; why: "total" | "hourly" }

// Se compara con el PEOR caso de una llamada: aunque la llamada salga lo más
// cara posible, no se pasa del tope.
export function decideBudget(spend: Spend, budget: BudgetSettings, limits: ChatLimits): BudgetDecision {
  if (spend.totalUsd + WORST_CASE_COST_USD > capUsd(budget)) return { allowed: false, why: "total" }
  if (spend.hourUsd + WORST_CASE_COST_USD > limits.hourlyUsd) return { allowed: false, why: "hourly" }
  return { allowed: true }
}

// --- Límite por usuario (documento rate_limits/{uid}) ------------------------

export type RateLimitState = { minute: string; minuteCount: number; day: string; dayCount: number }

export function parseRateLimitState(raw: unknown): RateLimitState | null {
  if (!raw || typeof raw !== "object") return null
  const r = raw as Record<string, unknown>
  if (typeof r.minute !== "string" || typeof r.day !== "string") return null
  if (typeof r.minuteCount !== "number" || typeof r.dayCount !== "number") return null
  return { minute: r.minute, minuteCount: r.minuteCount, day: r.day, dayCount: r.dayCount }
}

// Ventanas fijas: si la ventana guardada no es la actual, su contador vuelve
// a 0. Una pregunta bloqueada no suma.
export function decideRateLimit(
  prev: RateLimitState | null,
  now: Date,
  limits: ChatLimits
): { allowed: boolean; next: RateLimitState } {
  const minute = minuteKey(now)
  const day = dayKey(now)
  const minuteCount = prev && prev.minute === minute ? prev.minuteCount : 0
  const dayCount = prev && prev.day === day ? prev.dayCount : 0
  if (minuteCount >= limits.perMinute || dayCount >= limits.perDay) {
    return { allowed: false, next: { minute, minuteCount, day, dayCount } }
  }
  return { allowed: true, next: { minute, minuteCount: minuteCount + 1, day, dayCount: dayCount + 1 } }
}

// --- Errores del modelo que igual se cobraron --------------------------------

// El modelo respondió (y cobró) pero la respuesta no sirve: refusal o sin
// texto. Lleva el uso para poder registrar el costo.
export class PaidModelError extends Error {
  usage: ModelUsage
  constructor(message: string, usage: ModelUsage) {
    super(message)
    this.name = "PaidModelError"
    this.usage = usage
  }
}
```

- [ ] **Paso 4: Correr las pruebas y ver que pasan**

Run: `node --experimental-strip-types --test lib/usage.test.ts`
Esperado: todas pasan.

- [ ] **Paso 5: Commit (lo hace el usuario)**

Mensaje sugerido: `feat(rol5): decisiones puras del medidor (tope, límite por usuario, config)`

---

### Tarea 3: Almacenamiento del medidor, versión en memoria (`usageStore.ts`)

**Archivos:**
- Crear: `apps/mobile/lib/usageStore.ts`
- Prueba: `apps/mobile/lib/usageStore.test.ts`

**Interfaces:**
- Usa (de `./usage.ts`): `ChatConfig`, `ChatLimits`, `RateLimitState`, `Spend`, `UsageCounters`, `UsageRecord`, `DEFAULT_CONFIG`, `addCounters`, `countersDelta`, `dayKey`, `decideRateLimit`, `emptyCounters`, `hourKey`.
- Produce:
  - `interface UsageStore { getConfig(): Promise<ChatConfig>; consumeRateLimit(uid: string, now: Date, limits: ChatLimits): Promise<boolean>; getSpend(now: Date): Promise<Spend>; record(rec: UsageRecord, now: Date): Promise<void> }`
  - `class MemoryUsageStore implements UsageStore`, con los campos públicos `config`, `totals`, `days: Map<string, UsageCounters>`, `hours: Map<string, UsageCounters>` y `rateLimits: Map<string, RateLimitState>`.

- [ ] **Paso 1: Escribir las pruebas que fallan**

`apps/mobile/lib/usageStore.test.ts`:

```ts
import { test } from "node:test"
import assert from "node:assert/strict"
import { costUsd } from "./pricing.ts"
import { dayKey, hourKey } from "./usage.ts"
import { MemoryUsageStore } from "./usageStore.ts"

const NOW = new Date("2026-10-13T15:04:05Z")
const LIMITS = { perMinute: 2, perDay: 40, hourlyUsd: 1 }
const USAGE = { inputTokens: 900, outputTokens: 80 }

test("record suma en totales, en el día y en la hora", async () => {
  const s = new MemoryUsageStore()
  await s.record({ path: "model", usage: USAGE }, NOW)
  await s.record({ path: "no_model" }, NOW)
  assert.equal(s.totals.spentUsd, costUsd(USAGE))
  assert.equal(s.totals.questions.model, 1)
  assert.equal(s.totals.questions.no_model, 1)
  assert.equal(s.days.get(dayKey(NOW))?.questions.model, 1)
  assert.equal(s.hours.get(hourKey(NOW))?.spentUsd, costUsd(USAGE))
})

test("getSpend: total y hora actual; otra hora empieza en 0", async () => {
  const s = new MemoryUsageStore()
  await s.record({ path: "model", usage: USAGE }, NOW)
  assert.deepEqual(await s.getSpend(NOW), { totalUsd: costUsd(USAGE), hourUsd: costUsd(USAGE) })
  const nextHour = new Date("2026-10-13T16:00:00Z")
  assert.deepEqual(await s.getSpend(nextHour), { totalUsd: costUsd(USAGE), hourUsd: 0 })
})

test("límite: preguntas simultáneas del mismo usuario → pasan exactamente las permitidas", async () => {
  const s = new MemoryUsageStore()
  const results = await Promise.all([1, 2, 3].map(() => s.consumeRateLimit("u1", NOW, LIMITS)))
  assert.deepEqual(results.sort(), [false, true, true])
})

test("límite: cada usuario tiene el suyo", async () => {
  const s = new MemoryUsageStore()
  await s.consumeRateLimit("u1", NOW, LIMITS)
  await s.consumeRateLimit("u1", NOW, LIMITS)
  assert.equal(await s.consumeRateLimit("u1", NOW, LIMITS), false)
  assert.equal(await s.consumeRateLimit("u2", NOW, LIMITS), true)
})
```

- [ ] **Paso 2: Correr las pruebas y ver que fallan**

Run: `node --experimental-strip-types --test lib/usageStore.test.ts`
Esperado: FALLA con `Cannot find module` (no existe `usageStore.ts`).

- [ ] **Paso 3: Implementar**

`apps/mobile/lib/usageStore.ts`:

```ts
import {
  DEFAULT_CONFIG,
  addCounters,
  countersDelta,
  dayKey,
  decideRateLimit,
  emptyCounters,
  hourKey,
  type ChatConfig,
  type ChatLimits,
  type RateLimitState,
  type Spend,
  type UsageCounters,
  type UsageRecord,
} from "./usage.ts"

// ---------------------------------------------------------------------------
// Dónde vive el medidor (Rol 5). En producción, Firestore con el Admin SDK
// (usageStoreFirestore.ts). Acá, la interfaz y una versión EN MEMORIA para
// pruebas y para desarrollo local. Diseño: docs/medidor-gasto.md.
// ---------------------------------------------------------------------------

export interface UsageStore {
  // Interruptor y límites (documento config/chat).
  getConfig(): Promise<ChatConfig>
  // Revisa y, si se permite, suma una pregunta del usuario. Atómico: dos
  // preguntas simultáneas no pueden pasar las dos el límite.
  consumeRateLimit(uid: string, now: Date, limits: ChatLimits): Promise<boolean>
  // Gasto acumulado y de la hora actual, para el tope y el freno.
  getSpend(now: Date): Promise<Spend>
  // Suma una pregunta (con su camino y, si hubo modelo, sus tokens).
  record(rec: UsageRecord, now: Date): Promise<void>
}

export class MemoryUsageStore implements UsageStore {
  config: ChatConfig = DEFAULT_CONFIG
  totals: UsageCounters = emptyCounters()
  days = new Map<string, UsageCounters>()
  hours = new Map<string, UsageCounters>()
  rateLimits = new Map<string, RateLimitState>()

  async getConfig(): Promise<ChatConfig> {
    return this.config
  }

  // Sin `await` entre leer y escribir: en memoria esto ya es atómico.
  async consumeRateLimit(uid: string, now: Date, limits: ChatLimits): Promise<boolean> {
    const { allowed, next } = decideRateLimit(this.rateLimits.get(uid) ?? null, now, limits)
    if (allowed) this.rateLimits.set(uid, next)
    return allowed
  }

  async getSpend(now: Date): Promise<Spend> {
    return { totalUsd: this.totals.spentUsd, hourUsd: this.hours.get(hourKey(now))?.spentUsd ?? 0 }
  }

  async record(rec: UsageRecord, now: Date): Promise<void> {
    const delta = countersDelta(rec)
    this.totals = addCounters(this.totals, delta)
    const day = dayKey(now)
    const hour = hourKey(now)
    this.days.set(day, addCounters(this.days.get(day) ?? emptyCounters(), delta))
    this.hours.set(hour, addCounters(this.hours.get(hour) ?? emptyCounters(), delta))
  }
}
```

- [ ] **Paso 4: Correr las pruebas y ver que pasan**

Run: `node --experimental-strip-types --test lib/usageStore.test.ts`
Esperado: 4 pruebas pasan.

- [ ] **Paso 5: Commit (lo hace el usuario)**

Mensaje sugerido: `feat(rol5): interfaz del medidor y versión en memoria`

---

### Tarea 4: Motivos nuevos en el contrato del chat (archivos de Rol 2)

**Archivos:**
- Modificar: `apps/mobile/lib/chat.ts` (tipo `NoAnswerReason`, ~línea 49; `NO_ANSWER_TEXT`, ~línea 167)
- Modificar: `apps/mobile/components/ChatPanel.tsx` (~línea 173)
- Prueba: `apps/mobile/lib/chat.test.ts` (agregar al final)

**Interfaces:**
- Produce: `NoAnswerReason` incluye `"rate_limited" | "chat_disabled" | "off_topic"`, y `NO_ANSWER_TEXT` tiene un texto para cada uno, además de `budget_exhausted`, `unauthenticated` y `error`.

- [ ] **Paso 1: Escribir la prueba que falla** (agregar al final de `lib/chat.test.ts`; si `NO_ANSWER_TEXT` no está importado arriba, sumarlo al import existente desde `"./chat.ts"`)

```ts
test("motivos del medidor (Rol 5): cada uno tiene un texto claro, sin detalles técnicos", () => {
  for (const reason of ["rate_limited", "chat_disabled", "off_topic", "budget_exhausted"] as const) {
    const text = NO_ANSWER_TEXT[reason]
    assert.ok(text.length > 20, reason)
    assert.doesNotMatch(text, /error|token|firestore|api|429|500/i, reason)
  }
})
```

- [ ] **Paso 2: Correr la prueba y ver que falla**

Run: `node --experimental-strip-types --test lib/chat.test.ts`
Esperado: FALLA (`NO_ANSWER_TEXT.rate_limited` es `undefined`, así que lanza al leer `.length`).

- [ ] **Paso 3: Implementar en `lib/chat.ts`**

Reemplazar el tipo `NoAnswerReason`:

```ts
export type NoAnswerReason =
  | "empty_question" // vacía o solo un saludo
  | "too_long" // protege el costo
  | "no_news" // ninguna noticia publicada responde a la pregunta
  | "off_topic" // pedido ajeno a las noticias (Rol 5, RC-14)
  | "rate_limited" // el usuario pasó su límite de preguntas (Rol 5, RC-17)
  | "chat_disabled" // un admin apagó el chat desde el portal (Rol 5, RC-20)
  | "budget_exhausted" // se alcanzó el tope de gasto o el freno por hora (Rol 5)
  | "unauthenticated"
  | "error"
```

Reemplazar `NO_ANSWER_TEXT` (se conservan los 3 textos que ya existían):

```ts
// Mensajes fijos para los casos que decide el endpoint (no la pregunta).
export const NO_ANSWER_TEXT: Record<
  "budget_exhausted" | "rate_limited" | "chat_disabled" | "off_topic" | "unauthenticated" | "error",
  string
> = {
  budget_exhausted:
    "El chat llegó a su límite de uso por ahora, para no agotar el presupuesto del proyecto. Mientras tanto puedes leer todas las noticias en tu portada.",
  rate_limited:
    "Hiciste muchas preguntas seguidas. Espera un momento y vuelve a intentar; mientras tanto puedes leer tu portada.",
  chat_disabled: "El chat está pausado por ahora. Puedes leer todas las noticias en tu portada.",
  off_topic:
    "Solo puedo responder sobre las noticias publicadas en la app. Prueba con una de las preguntas de ejemplo.",
  unauthenticated: "Tu sesión expiró. Vuelve a iniciar sesión para usar el chat.",
  error: "No pude responder en este momento. Intenta de nuevo en unos segundos.",
}
```

- [ ] **Paso 4: Mostrar el enlace a la portada también en los motivos nuevos** (`components/ChatPanel.tsx`)

Reemplazar:

```tsx
        {response.reason === "budget_exhausted" && (
```

por:

```tsx
        {(response.reason === "budget_exhausted" ||
          response.reason === "rate_limited" ||
          response.reason === "chat_disabled") && (
```

- [ ] **Paso 5: Correr todas las pruebas y el chequeo de tipos**

Run: `npm test -w @respai/mobile` y después `npm run typecheck -w @respai/mobile`
Esperado: todo pasa y `tsc` no da errores.

- [ ] **Paso 6: Commit (lo hace el usuario)**

Mensaje sugerido: `feat(chat): motivos del medidor de gasto (rate_limited, chat_disabled, off_topic)`. En el PR, avisar a Rol 2: son archivos suyos.

---

### Tarea 5: Orquestación con medidor (`meteredChat.ts`)

**Archivos:**
- Crear: `apps/mobile/lib/meteredChat.ts`
- Prueba: `apps/mobile/lib/meteredChat.test.ts`

**Interfaces:**
- Usa:
  - de `./chatPipeline.ts`: `answerQuestion(req, news, today, generate)`, que devuelve `{ response, trace: { path: "no_model" | "simulated" | "model"; reason?; newsCount; usage? } }`, y los tipos `Generate`, `ModelUsage`;
  - `NO_ANSWER_TEXT`, `ChatRequest`, `ChatResponse` (Tarea 4);
  - `costUsd` (Tarea 1);
  - `PaidModelError`, `decideBudget`, `BudgetSettings`, `ChatConfig`, `UsagePath` (Tarea 2);
  - `UsageStore` (Tarea 3).
- Produce:
  - `type MeteredTrace = { path: UsagePath; reason?: string; newsCount: number; usage?: ModelUsage; costUsd?: number; recordFailed?: true }`
  - `type MeteredDeps = { store: UsageStore; generate: Generate | null; budget: BudgetSettings | null; now: Date; today: string }`
  - `meteredAnswer(uid: string, req: ChatRequest, loadNews: () => Promise<News[]>, deps: MeteredDeps): Promise<{ response: ChatResponse; trace: MeteredTrace }>`

  Los errores de `loadNews` (por ejemplo `UnauthenticatedError`) **se propagan** al endpoint, que ya los maneja.

- [ ] **Paso 1: Escribir las pruebas que fallan**

`apps/mobile/lib/meteredChat.test.ts`:

```ts
import { test } from "node:test"
import assert from "node:assert/strict"
import type { News } from "@respai/shared"
import type { Generate } from "./chatPipeline.ts"
import { meteredAnswer, type MeteredDeps } from "./meteredChat.ts"
import { WORST_CASE_COST_USD, costUsd } from "./pricing.ts"
import { PaidModelError, emptyCounters, hourKey } from "./usage.ts"
import { MemoryUsageStore } from "./usageStore.ts"

// Pruebas del chat CON medidor (Rol 5), sin red y sin gastar: el modelo es
// falso y el almacenamiento está en memoria. Ver docs/medidor-gasto.md.

function makeNews(n: Partial<News> & Pick<News, "id" | "title">): News {
  return {
    summary: "",
    body: "",
    sources: [{ name: "Fuente", type: "original" }],
    authorId: "test",
    validationStatus: "confirmed",
    scope: "national",
    topics: [],
    createdAt: "2026-10-01T00:00:00.000Z",
    ...n,
  }
}

const NEWS: News[] = [
  makeNews({
    id: "espana", title: "Pedro Sánchez adelanta elecciones en España", country: "España", topics: ["política"],
    summary: "Las elecciones generales serán el 29 de noviembre.",
  }),
]
const LOCATION = { country: "Guatemala", region: "Quetzaltenango" }
const NOW = new Date("2026-10-13T15:04:05Z")
const USAGE = { inputTokens: 900, outputTokens: 80 }
const NEEDS_MODEL = "Explícame las elecciones en España"
const NO_NEWS = "¿Qué pasó con el terremoto en Japón?"

function setup(overrides: Partial<Omit<MeteredDeps, "store">> = {}) {
  const store = new MemoryUsageStore()
  const calls: string[] = []
  const generate: Generate = async (prompt) => {
    calls.push(prompt.user)
    return { text: "Se adelantan las elecciones [1].", usage: USAGE }
  }
  let loads = 0
  const deps: MeteredDeps = {
    store, generate, budget: { budgetUsd: 20, reserveUsd: 10 }, now: NOW, today: "2026-10-13", ...overrides,
  }
  const ask = (question: string, uid = "u1") =>
    meteredAnswer(uid, { question, location: LOCATION }, async () => { loads++; return NEWS }, deps)
  return { store, calls, ask, loads: () => loads }
}

test("necesita modelo: lo llama una vez y registra tokens y costo reales", async () => {
  const { store, calls, ask } = setup()
  const { response, trace } = await ask(NEEDS_MODEL)
  assert.equal(response.kind, "answer")
  assert.equal(calls.length, 1)
  assert.equal(trace.path, "model")
  assert.equal(trace.costUsd, costUsd(USAGE))
  assert.equal(store.totals.questions.model, 1)
  assert.equal(store.totals.inputTokens, 900)
  assert.equal(store.totals.outputTokens, 80)
  assert.equal(store.totals.spentUsd, costUsd(USAGE))
  assert.equal(store.hours.get(hourKey(NOW))?.spentUsd, costUsd(USAGE))
})

test("sin noticias: no llama al modelo y cuenta como no_model (USD 0)", async () => {
  const { store, calls, ask } = setup()
  const { response, trace } = await ask(NO_NEWS)
  assert.equal(response.kind, "no_answer")
  assert.equal(trace.path, "no_model")
  assert.equal(calls.length, 0)
  assert.equal(store.totals.questions.no_model, 1)
  assert.equal(store.totals.spentUsd, 0)
})

test("chat apagado: no lee noticias ni llama al modelo", async () => {
  const { store, calls, ask, loads } = setup()
  store.config = { ...store.config, enabled: false }
  const { response, trace } = await ask(NEEDS_MODEL)
  assert.equal(response.kind === "no_answer" && response.reason, "chat_disabled")
  assert.equal(trace.path, "disabled")
  assert.equal(loads(), 0)
  assert.equal(calls.length, 0)
  assert.equal(store.totals.questions.disabled, 1)
})

test("límite por minuto: la pregunta extra no lee noticias ni llama al modelo", async () => {
  const { store, calls, ask, loads } = setup()
  store.config = { enabled: true, limits: { perMinute: 2, perDay: 40, hourlyUsd: 1 } }
  await ask(NEEDS_MODEL)
  await ask(NEEDS_MODEL)
  const { response, trace } = await ask(NEEDS_MODEL)
  assert.equal(response.kind === "no_answer" && response.reason, "rate_limited")
  assert.equal(trace.path, "rate_limited")
  assert.equal(calls.length, 2)
  assert.equal(loads(), 2)
  assert.equal(store.totals.questions.rate_limited, 1)
})

test("tope total: gasto + peor caso > USD 10 → budget_exhausted sin llamar al modelo", async () => {
  const { store, calls, ask } = setup()
  store.totals = { ...emptyCounters(), spentUsd: 10 - WORST_CASE_COST_USD / 2 }
  const { response, trace } = await ask(NEEDS_MODEL)
  assert.equal(response.kind === "no_answer" && response.reason, "budget_exhausted")
  assert.equal(trace.path, "budget_blocked")
  assert.equal(trace.reason, "total")
  assert.equal(calls.length, 0)
})

test("tope total: con margen para una llamada más, sí llama al modelo", async () => {
  const { store, calls, ask } = setup()
  store.totals = { ...emptyCounters(), spentUsd: 10 - 2 * WORST_CASE_COST_USD }
  await ask(NEEDS_MODEL)
  assert.equal(calls.length, 1)
})

test("freno por hora: el gasto de la hora llegó al límite → budget_exhausted", async () => {
  const { store, calls, ask } = setup()
  store.hours.set(hourKey(NOW), { ...emptyCounters(), spentUsd: 1 })
  const { trace } = await ask(NEEDS_MODEL)
  assert.equal(trace.path, "budget_blocked")
  assert.equal(trace.reason, "hourly")
  assert.equal(calls.length, 0)
})

test("presupuesto mal configurado: modo de prueba, nunca llama al modelo", async () => {
  const { calls, ask } = setup({ budget: null })
  const { response, trace } = await ask(NEEDS_MODEL)
  assert.equal(response.kind === "answer" && response.generatedBy, "rules")
  assert.equal(trace.path, "simulated")
  assert.equal(calls.length, 0)
})

test("sin API key: modo de prueba", async () => {
  const { store, ask } = setup({ generate: null })
  const { trace } = await ask(NEEDS_MODEL)
  assert.equal(trace.path, "simulated")
  assert.equal(store.totals.questions.simulated, 1)
})

test("el modelo cobró pero no sirvió: mensaje claro y el costo igual se registra", async () => {
  const failing: Generate = async () => {
    throw new PaidModelError("refusal", USAGE)
  }
  const { store, ask } = setup({ generate: failing })
  const { response, trace } = await ask(NEEDS_MODEL)
  assert.equal(response.kind === "no_answer" && response.reason, "error")
  assert.equal(trace.path, "error")
  assert.equal(store.totals.spentUsd, costUsd(USAGE))
  assert.equal(store.totals.questions.error, 1)
})

test("Firestore caído al leer la config: no lee noticias ni llama al modelo", async () => {
  const { store, calls, ask, loads } = setup()
  store.getConfig = async () => {
    throw new Error("Firestore caído")
  }
  const { response } = await ask(NEEDS_MODEL)
  assert.equal(response.kind === "no_answer" && response.reason, "error")
  assert.equal(loads(), 0)
  assert.equal(calls.length, 0)
})

test("Firestore caído al revisar el gasto: no llama al modelo", async () => {
  const { store, calls, ask } = setup()
  store.getSpend = async () => {
    throw new Error("Firestore caído")
  }
  const { response, trace } = await ask(NEEDS_MODEL)
  assert.equal(response.kind === "no_answer" && response.reason, "error")
  assert.equal(trace.path, "error")
  assert.equal(calls.length, 0)
})

test("falla al registrar después de pagar: la respuesta sale igual", async () => {
  const { store, ask } = setup()
  store.record = async () => {
    throw new Error("Firestore caído")
  }
  const { response, trace } = await ask(NEEDS_MODEL)
  assert.equal(response.kind, "answer")
  assert.equal(trace.recordFailed, true)
  assert.equal(trace.costUsd, costUsd(USAGE))
})
```

- [ ] **Paso 2: Correr las pruebas y ver que fallan**

Run: `node --experimental-strip-types --test lib/meteredChat.test.ts`
Esperado: FALLA con `Cannot find module` (no existe `meteredChat.ts`).

- [ ] **Paso 3: Implementar**

`apps/mobile/lib/meteredChat.ts`:

```ts
import type { News } from "@respai/shared"
import { NO_ANSWER_TEXT, type ChatRequest, type ChatResponse } from "./chat.ts"
import { answerQuestion, type Generate, type ModelUsage } from "./chatPipeline.ts"
import { costUsd } from "./pricing.ts"
import { PaidModelError, decideBudget, type BudgetSettings, type ChatConfig, type UsagePath } from "./usage.ts"
import type { UsageStore } from "./usageStore.ts"

// ---------------------------------------------------------------------------
// El chat CON medidor de gasto (Rol 5). Envuelve a answerQuestion (Rol 2) sin
// modificarla. Orden (docs/medidor-gasto.md):
//   interruptor → límite del usuario → noticias → (respuesta sin modelo)
//   → tope total y freno por hora → modelo → registrar uso.
// Regla: ante la duda NO se llama al modelo (falla cerrada).
// Puro respecto a la red: Firestore y el modelo llegan como dependencias.
// ---------------------------------------------------------------------------

export type MeteredTrace = {
  path: UsagePath
  reason?: string
  newsCount: number
  usage?: ModelUsage
  costUsd?: number
  recordFailed?: true
}

export type MeteredDeps = {
  store: UsageStore
  generate: Generate | null // null: sin API key → modo de prueba
  budget: BudgetSettings | null // null: BUDGET_USD / RESERVE_USD inválidos → nunca se llama al modelo
  now: Date
  today: string // YYYY-MM-DD, para el prompt
}

class BudgetBlocked extends Error {}

type EndpointReason = "chat_disabled" | "rate_limited" | "budget_exhausted" | "error"

function noAnswer(reason: EndpointReason): ChatResponse {
  return { kind: "no_answer", reason, text: NO_ANSWER_TEXT[reason] }
}

export async function meteredAnswer(
  uid: string,
  req: ChatRequest,
  loadNews: () => Promise<News[]>,
  deps: MeteredDeps
): Promise<{ response: ChatResponse; trace: MeteredTrace }> {
  const { store, now } = deps

  // Toda pregunta suma a los contadores con su camino. Si registrar falla, la
  // respuesta sale igual (si hubo modelo, ya se pagó) y queda en el log.
  const finish = async (response: ChatResponse, trace: MeteredTrace) => {
    try {
      await store.record({ path: trace.path, ...(trace.usage ? { usage: trace.usage } : {}) }, now)
      return { response, trace }
    } catch (e) {
      console.error("[usage] No se pudo registrar el uso", e)
      return { response, trace: { ...trace, recordFailed: true as const } }
    }
  }
  const storeDown = (e: unknown) => {
    console.error("[usage] Firestore no respondió; no se llama al modelo", e)
    return finish(noAnswer("error"), { path: "error", reason: "store", newsCount: 0 })
  }

  // 1. Interruptor.
  let config: ChatConfig
  try {
    config = await store.getConfig()
  } catch (e) {
    return storeDown(e)
  }
  if (!config.enabled) return finish(noAnswer("chat_disabled"), { path: "disabled", newsCount: 0 })

  // 2. Límite del usuario.
  let allowed: boolean
  try {
    allowed = await store.consumeRateLimit(uid, now, config.limits)
  } catch (e) {
    return storeDown(e)
  }
  if (!allowed) return finish(noAnswer("rate_limited"), { path: "rate_limited", newsCount: 0 })

  // 3. Noticias. Sus errores (p. ej. sesión vencida) los maneja el endpoint.
  const news = await loadNews()

  // 4. El modelo solo se llama si hay key, presupuesto válido y el tope lo
  // permite. El chequeo va DENTRO de generate: answerQuestion solo lo invoca
  // cuando de verdad hace falta redactar (las respuestas sin modelo no gastan
  // ni una lectura del gasto).
  const { generate: modelGenerate, budget } = deps
  const generate: Generate | null =
    modelGenerate && budget
      ? async (prompt) => {
          const decision = decideBudget(await store.getSpend(now), budget, config.limits)
          if (!decision.allowed) throw new BudgetBlocked(decision.why)
          return modelGenerate(prompt)
        }
      : null

  try {
    const { response, trace } = await answerQuestion(req, news, deps.today, generate)
    return finish(response, {
      path: trace.path,
      ...(trace.reason ? { reason: trace.reason } : {}),
      newsCount: trace.newsCount,
      ...(trace.usage ? { usage: trace.usage, costUsd: costUsd(trace.usage) } : {}),
    })
  } catch (e) {
    if (e instanceof BudgetBlocked) {
      return finish(noAnswer("budget_exhausted"), { path: "budget_blocked", reason: e.message, newsCount: 0 })
    }
    if (e instanceof PaidModelError) {
      console.error("[chat] El modelo cobró pero no dio una respuesta usable:", e.message)
      return finish(noAnswer("error"), {
        path: "error", reason: e.message, newsCount: 0, usage: e.usage, costUsd: costUsd(e.usage),
      })
    }
    console.error("[chat] Error al responder", e)
    return finish(noAnswer("error"), { path: "error", newsCount: 0 })
  }
}
```

- [ ] **Paso 4: Correr las pruebas y ver que pasan**

Run: `node --experimental-strip-types --test lib/meteredChat.test.ts`
Esperado: 13 pruebas pasan.

- [ ] **Paso 5: Correr todo**

Run: `npm test -w @respai/mobile` y `npm run typecheck -w @respai/mobile`
Esperado: todo pasa.

- [ ] **Paso 6: Commit (lo hace el usuario)**

Mensaje sugerido: `feat(rol5): chat con medidor (interruptor, límite por usuario, tope y freno por hora)`

---

### Tarea 6: Conexión con Haiku 5.5 (`anthropic.ts`)

**Archivos:**
- Crear: `apps/mobile/lib/anthropic.ts`
- Prueba: `apps/mobile/lib/anthropic.test.ts`
- Modificar: `apps/mobile/package.json` (dependencia nueva, la agrega npm)

**Interfaces:**
- Usa: `BuiltPrompt` de `./prompt.ts` (`{ system; user; maxOutputTokens; estimatedInputTokens }`), `Generate` de `./chatPipeline.ts`, `CHAT_MODEL` (Tarea 1) y `PaidModelError` (Tarea 2).
- Produce:
  - `type ThinkingMode = "disabled" | "low"`, `parseThinkingMode(v: string | undefined): ThinkingMode` (por defecto `"disabled"`)
  - `type ModelMessage`, `type CreateMessage`
  - `requestParams(prompt, mode)`, `createGenerate(create: CreateMessage, mode: ThinkingMode): Generate`
  - `anthropicGenerate(apiKey: string, mode: ThinkingMode): Generate`

- [ ] **Paso 1: Instalar el SDK** (desde la raíz)

Run: `npm install @anthropic-ai/sdk -w @respai/mobile`
Esperado: aparece en `dependencies` de `apps/mobile/package.json`.

- [ ] **Paso 2: Escribir las pruebas que fallan**

`apps/mobile/lib/anthropic.test.ts`:

```ts
import { test } from "node:test"
import assert from "node:assert/strict"
import { createGenerate, parseThinkingMode, type CreateMessage, type ModelMessage } from "./anthropic.ts"
import type { BuiltPrompt } from "./prompt.ts"
import { PaidModelError } from "./usage.ts"

// Sin red: `create` es falso y guarda los parámetros que recibió.

const PROMPT: BuiltPrompt = { system: "reglas", user: "pregunta", maxOutputTokens: 350, estimatedInputTokens: 10 }

function fakeCreate(reply: ModelMessage) {
  const sent: Record<string, unknown>[] = []
  const create: CreateMessage = async (params) => {
    sent.push(params as unknown as Record<string, unknown>)
    return reply
  }
  return { create, sent }
}

const OK: ModelMessage = {
  content: [{ type: "text", text: "Hola " }, { type: "text", text: "[1]." }],
  stop_reason: "end_turn",
  usage: { input_tokens: 900, output_tokens: 80 },
}

test("modo por defecto: pensamiento desactivado", () => {
  assert.equal(parseThinkingMode(undefined), "disabled")
  assert.equal(parseThinkingMode("cualquier cosa"), "disabled")
  assert.equal(parseThinkingMode("low"), "low")
})

test("pide Haiku 5.5 con el prompt, max_tokens y sin pensamiento", async () => {
  const { create, sent } = fakeCreate(OK)
  await createGenerate(create, "disabled")(PROMPT)
  assert.equal(sent[0].model, "claude-haiku-5-5")
  assert.equal(sent[0].max_tokens, 350)
  assert.equal(sent[0].system, "reglas")
  assert.deepEqual(sent[0].messages, [{ role: "user", content: "pregunta" }])
  assert.deepEqual(sent[0].thinking, { type: "disabled" })
  assert.equal(sent[0].output_config, undefined)
})

test("modo low: esfuerzo low en vez de desactivar el pensamiento", async () => {
  const { create, sent } = fakeCreate(OK)
  await createGenerate(create, "low")(PROMPT)
  assert.deepEqual(sent[0].output_config, { effort: "low" })
  assert.equal(sent[0].thinking, undefined)
})

test("devuelve el texto unido y el uso real de tokens", async () => {
  const { create } = fakeCreate(OK)
  const out = await createGenerate(create, "disabled")(PROMPT)
  assert.equal(out.text, "Hola [1].")
  assert.deepEqual(out.usage, { inputTokens: 900, outputTokens: 80 })
})

test("refusal: lanza PaidModelError con el uso cobrado", async () => {
  const { create } = fakeCreate({ ...OK, content: [], stop_reason: "refusal" })
  await assert.rejects(createGenerate(create, "disabled")(PROMPT), (e: unknown) => {
    assert.ok(e instanceof PaidModelError)
    assert.deepEqual(e.usage, { inputTokens: 900, outputTokens: 80 })
    return true
  })
})

test("sin texto (p. ej. se acabó max_tokens pensando): PaidModelError", async () => {
  const { create } = fakeCreate({ ...OK, content: [{ type: "thinking" }], stop_reason: "max_tokens" })
  await assert.rejects(createGenerate(create, "disabled")(PROMPT), PaidModelError)
})
```

- [ ] **Paso 3: Correr las pruebas y ver que fallan**

Run: `node --experimental-strip-types --test lib/anthropic.test.ts`
Esperado: FALLA con `Cannot find module` (no existe `anthropic.ts`).

- [ ] **Paso 4: Implementar**

`apps/mobile/lib/anthropic.ts`:

```ts
import Anthropic from "@anthropic-ai/sdk"
import type { Generate } from "./chatPipeline.ts"
import { CHAT_MODEL } from "./pricing.ts"
import type { BuiltPrompt } from "./prompt.ts"
import { PaidModelError } from "./usage.ts"

// ---------------------------------------------------------------------------
// La única llamada a un modelo en todo el producto (Rol 5 + Rol 2): Haiku 5.5
// redacta la respuesta del chat. SOLO SERVIDOR: usa ANTHROPIC_API_KEY.
// Una llamada por pregunta, sin herramientas (RC-04, docs/reduccion-costos.md).
// ---------------------------------------------------------------------------

// Pensamiento al mínimo (RC-08). "disabled" por defecto; "low" queda para
// compararlo en el banco de pruebas. Variable de entorno: CHAT_THINKING.
export type ThinkingMode = "disabled" | "low"

export function parseThinkingMode(v: string | undefined): ThinkingMode {
  return v === "low" ? "low" : "disabled"
}

// Lo mínimo que usamos de la respuesta de la API (permite probar sin red).
export type ModelMessage = {
  content: Array<{ type: string; text?: string }>
  stop_reason: string | null
  usage: { input_tokens: number; output_tokens: number }
}
export type CreateMessage = (params: Anthropic.MessageCreateParamsNonStreaming) => Promise<ModelMessage>

export function requestParams(prompt: BuiltPrompt, mode: ThinkingMode): Anthropic.MessageCreateParamsNonStreaming {
  return {
    model: CHAT_MODEL,
    max_tokens: prompt.maxOutputTokens, // incluye el pensamiento: tope duro de salida
    system: prompt.system,
    messages: [{ role: "user", content: prompt.user }],
    ...(mode === "disabled" ? { thinking: { type: "disabled" as const } } : { output_config: { effort: "low" as const } }),
  }
}

export function createGenerate(create: CreateMessage, mode: ThinkingMode): Generate {
  return async (prompt) => {
    const msg = await create(requestParams(prompt, mode))
    const usage = { inputTokens: msg.usage.input_tokens, outputTokens: msg.usage.output_tokens }
    if (msg.stop_reason === "refusal") throw new PaidModelError("refusal", usage)
    const text = msg.content
      .filter((b) => b.type === "text" && typeof b.text === "string")
      .map((b) => b.text)
      .join("")
      .trim()
    if (!text) throw new PaidModelError(`sin texto (stop_reason: ${msg.stop_reason})`, usage)
    return { text, usage }
  }
}

export function anthropicGenerate(apiKey: string, mode: ThinkingMode): Generate {
  // Un solo reintento y 20 s de espera: más reintentos = más gasto posible.
  const client = new Anthropic({ apiKey, maxRetries: 1, timeout: 20_000 })
  return createGenerate((params) => client.messages.create(params), mode)
}
```

- [ ] **Paso 5: Correr las pruebas y el chequeo de tipos**

Run: `node --experimental-strip-types --test lib/anthropic.test.ts` y `npm run typecheck -w @respai/mobile`
Esperado: 6 pruebas pasan y `tsc` sin errores. Si `tsc` rechaza `thinking: { type: "disabled" }` u `output_config` por la versión del SDK instalada, revisar los tipos de `Anthropic.MessageCreateParamsNonStreaming` en `node_modules/@anthropic-ai/sdk` y ajustar a los nombres que exponga. Las pruebas no deberían cambiar.

- [ ] **Paso 6: Commit (lo hace el usuario)**

Mensaje sugerido: `feat(rol5): conexión con Claude Haiku 5.5 (sin herramientas, pensamiento al mínimo)`

---

### Tarea 7: Firestore con el Admin SDK (`serverAuth.ts`, `usageStoreFirestore.ts`)

**Archivos:**
- Crear: `apps/mobile/lib/serverAuth.ts`
- Crear: `apps/mobile/lib/usageStoreFirestore.ts`
- Prueba: `apps/mobile/lib/serverAuth.test.ts`
- Modificar: `apps/mobile/package.json` (la agrega npm)

**Interfaces:**
- Usa:
  - de `./usage.ts`: `countersDelta`, `dayKey`, `decideRateLimit`, `hourKey`, `incrementFields`, `parseChatConfig`, `parseRateLimitState` y los tipos;
  - `UsageStore` (Tarea 3).
- Produce:
  - `parseServiceAccount(raw: string | undefined): { projectId: string; clientEmail: string; privateKey: string } | null`
  - `getAdminApp(): App | null`
  - `verifyUid(app: App, idToken: string): Promise<string | null>`
  - `class FirestoreUsageStore implements UsageStore`, con `constructor(app: App)`

La transacción y los incrementos no se prueban en unidad: hace falta Firestore real o el emulador. La lógica que deciden (`decideRateLimit`, `incrementFields`, `parseChatConfig`) ya está probada en la Tarea 2. Se verifican en vivo en la Tarea 10.

- [ ] **Paso 1: Instalar el Admin SDK** (desde la raíz)

Run: `npm install firebase-admin -w @respai/mobile`
Esperado: aparece en `dependencies` de `apps/mobile/package.json`.

- [ ] **Paso 2: Escribir la prueba que falla**

`apps/mobile/lib/serverAuth.test.ts`:

```ts
import { test } from "node:test"
import assert from "node:assert/strict"
import { parseServiceAccount } from "./serverAuth.ts"

const VALID = JSON.stringify({
  project_id: "respai-news-app",
  client_email: "medidor@respai-news-app.iam.gserviceaccount.com",
  private_key: "-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----\n",
})

test("cuenta de servicio válida", () => {
  assert.deepEqual(parseServiceAccount(VALID), {
    projectId: "respai-news-app",
    clientEmail: "medidor@respai-news-app.iam.gserviceaccount.com",
    privateKey: "-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----\n",
  })
})

test("sin variable, JSON roto o campos faltantes → null (medidor apagado, sin modelo)", () => {
  assert.equal(parseServiceAccount(undefined), null)
  assert.equal(parseServiceAccount(""), null)
  assert.equal(parseServiceAccount("{no es json"), null)
  assert.equal(parseServiceAccount(JSON.stringify({ project_id: "x" })), null)
})
```

- [ ] **Paso 3: Correr la prueba y ver que falla**

Run: `node --experimental-strip-types --test lib/serverAuth.test.ts`
Esperado: FALLA con `Cannot find module` (no existe `serverAuth.ts`).

- [ ] **Paso 4: Implementar `serverAuth.ts`**

```ts
import { cert, getApps, initializeApp, type App } from "firebase-admin/app"
import { getAuth } from "firebase-admin/auth"

// ---------------------------------------------------------------------------
// Firebase Admin SDK (Rol 5). SOLO SERVIDOR. Le da al endpoint del chat una
// identidad propia para escribir el medidor de gasto, que el usuario no puede
// tocar con su token. Clave: FIREBASE_SERVICE_ACCOUNT (JSON) en Vercel.
// Por qué hace falta: docs/medidor-gasto.md.
// ---------------------------------------------------------------------------

export type ServiceAccount = { projectId: string; clientEmail: string; privateKey: string }

export function parseServiceAccount(raw: string | undefined): ServiceAccount | null {
  if (!raw) return null
  try {
    const j = JSON.parse(raw) as Record<string, unknown>
    if (typeof j.project_id !== "string" || typeof j.client_email !== "string" || typeof j.private_key !== "string") {
      return null
    }
    return { projectId: j.project_id, clientEmail: j.client_email, privateKey: j.private_key }
  } catch {
    return null
  }
}

// null si falta la cuenta de servicio: el endpoint sigue en modo de prueba.
export function getAdminApp(): App | null {
  const sa = parseServiceAccount(process.env.FIREBASE_SERVICE_ACCOUNT)
  if (!sa) return null
  return getApps()[0] ?? initializeApp({ credential: cert(sa) })
}

// Verifica el ID token del usuario (firma, vencimiento, proyecto). null si no vale.
export async function verifyUid(app: App, idToken: string): Promise<string | null> {
  try {
    return (await getAuth(app).verifyIdToken(idToken)).uid
  } catch {
    return null
  }
}
```

- [ ] **Paso 5: Implementar `usageStoreFirestore.ts`**

```ts
import type { App } from "firebase-admin/app"
import { FieldValue, getFirestore, type DocumentSnapshot, type Firestore } from "firebase-admin/firestore"
import {
  countersDelta,
  dayKey,
  decideRateLimit,
  hourKey,
  incrementFields,
  parseChatConfig,
  parseRateLimitState,
  type ChatConfig,
  type ChatLimits,
  type Spend,
  type UsageRecord,
} from "./usage.ts"
import type { UsageStore } from "./usageStore.ts"

// ---------------------------------------------------------------------------
// Medidor de gasto en Firestore (Rol 5). SOLO SERVIDOR (Admin SDK: no pasa por
// firestore.rules). Esquema: docs/medidor-gasto.md.
//   usage/totals, usage/totals/days/{día}, usage/totals/hours/{hora}
//   rate_limits/{uid}   config/chat
// ---------------------------------------------------------------------------

const CONFIG_TTL_MS = 30_000 // apagar el chat tarda como máximo esto en hacer efecto
let configCache: { value: ChatConfig; at: number } | null = null

const spentOf = (s: DocumentSnapshot) => {
  const v = s.exists ? s.get("spentUsd") : 0
  return typeof v === "number" ? v : 0
}

export class FirestoreUsageStore implements UsageStore {
  db: Firestore

  constructor(app: App) {
    this.db = getFirestore(app)
  }

  async getConfig(): Promise<ChatConfig> {
    if (configCache && Date.now() - configCache.at < CONFIG_TTL_MS) return configCache.value
    const snap = await this.db.doc("config/chat").get()
    const value = parseChatConfig(snap.exists ? snap.data() : null)
    configCache = { value, at: Date.now() }
    return value
  }

  // Transacción: dos preguntas simultáneas del mismo usuario no pueden pasar
  // las dos el límite.
  async consumeRateLimit(uid: string, now: Date, limits: ChatLimits): Promise<boolean> {
    const ref = this.db.collection("rate_limits").doc(uid)
    return this.db.runTransaction(async (tx) => {
      const snap = await tx.get(ref)
      const prev = snap.exists ? parseRateLimitState(snap.data()) : null
      const { allowed, next } = decideRateLimit(prev, now, limits)
      if (allowed) tx.set(ref, { ...next, updatedAt: FieldValue.serverTimestamp() })
      return allowed
    })
  }

  async getSpend(now: Date): Promise<Spend> {
    const [totals, hour] = await this.db.getAll(
      this.db.doc("usage/totals"),
      this.db.doc(`usage/totals/hours/${hourKey(now)}`)
    )
    return { totalUsd: spentOf(totals), hourUsd: spentOf(hour) }
  }

  // Incrementos atómicos en los 3 documentos a la vez: varios celulares no se pisan.
  async record(rec: UsageRecord, now: Date): Promise<void> {
    const fields = {
      ...incrementFields(countersDelta(rec), (n) => FieldValue.increment(n)),
      updatedAt: FieldValue.serverTimestamp(),
    }
    const batch = this.db.batch()
    for (const path of ["usage/totals", `usage/totals/days/${dayKey(now)}`, `usage/totals/hours/${hourKey(now)}`]) {
      batch.set(this.db.doc(path), fields, { merge: true })
    }
    await batch.commit()
  }
}
```

- [ ] **Paso 6: Correr las pruebas y el chequeo de tipos**

Run: `node --experimental-strip-types --test lib/serverAuth.test.ts` y `npm run typecheck -w @respai/mobile`
Esperado: 2 pruebas pasan y `tsc` sin errores.

- [ ] **Paso 7: Commit (lo hace el usuario)**

Mensaje sugerido: `feat(rol5): medidor en Firestore con el Admin SDK`

---

### Tarea 8: Conectar el endpoint (`app/api/chat/route.ts`, archivo de Rol 2)

**Archivos:**
- Modificar: `apps/mobile/app/api/chat/route.ts` (el archivo completo, abajo)

**Interfaces:**
- Usa: `getAdminApp` y `verifyUid` (Tarea 7), `FirestoreUsageStore` (Tarea 7), `meteredAnswer` (Tarea 5), `anthropicGenerate` y `parseThinkingMode` (Tarea 6), `parseBudgetEnv` (Tarea 2). Siguen igual `parseChatRequest`, `answerQuestion` y `fetchPublishedNewsRest`.
- Comportamiento:
  - **Sin `FIREBASE_SERVICE_ACCOUNT`:** exactamente lo de hoy (modo de prueba, `generate = null`), más un aviso en el log.
  - **Con la variable:** el token se verifica con el Admin SDK y la respuesta pasa por `meteredAnswer`.

- [ ] **Paso 1: Reemplazar `route.ts`**

```ts
import { NO_ANSWER_TEXT, parseChatRequest, type ChatNoAnswer } from "@/lib/chat"
import { answerQuestion } from "@/lib/chatPipeline"
import { UnauthenticatedError, fetchPublishedNewsRest } from "@/lib/firestoreRest"
import { anthropicGenerate, parseThinkingMode } from "@/lib/anthropic"
import { meteredAnswer } from "@/lib/meteredChat"
import { getAdminApp, verifyUid } from "@/lib/serverAuth"
import { parseBudgetEnv } from "@/lib/usage"
import { FirestoreUsageStore } from "@/lib/usageStoreFirestore"

// ---------------------------------------------------------------------------
// POST /api/chat — endpoint del chat (Rol 2, medidor de gasto: Rol 5). Corre
// en el servidor (Vercel).
//
// Recibe: { question, location } + header `Authorization: Bearer <ID token de Firebase>`.
// Devuelve: ChatResponse (lib/chat.ts). Diseño: docs/chat.md y docs/medidor-gasto.md.
//
// 1. Sin token → no responde (nadie de afuera puede usar el chat ni gastar).
// 2. Lee las noticias publicadas en el SERVIDOR, con el token del usuario
//    (lib/firestoreRest.ts): el cliente no puede inyectar noticias.
// 3. Con FIREBASE_SERVICE_ACCOUNT: verifica el token con el Admin SDK y pasa
//    por el medidor (lib/meteredChat.ts): interruptor, límite por usuario,
//    tope total con reserva para la demo y freno por hora. El modelo
//    (Haiku 5.5, lib/anthropic.ts) solo se llama si todo eso lo permite.
//    Sin esa variable NO hay medidor, así que nunca se llama al modelo
//    (modo de prueba, como antes).
// ---------------------------------------------------------------------------

function noAnswer(status: number, reason: "unauthenticated" | "error"): Response {
  const body: ChatNoAnswer = { kind: "no_answer", reason, text: NO_ANSWER_TEXT[reason] }
  return Response.json(body, { status })
}

export async function POST(request: Request): Promise<Response> {
  const started = Date.now()

  const auth = request.headers.get("authorization") ?? ""
  const idToken = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length).trim() : ""
  if (!idToken) return noAnswer(401, "unauthenticated")

  let body: unknown = null
  try {
    body = await request.json()
  } catch {
    // cuerpo vacío o no-JSON: lo rechaza parseChatRequest
  }
  const req = parseChatRequest(body)
  if (!req) return noAnswer(400, "error")

  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  if (!projectId) {
    console.error("[chat] Falta NEXT_PUBLIC_FIREBASE_PROJECT_ID en el servidor")
    return noAnswer(500, "error")
  }

  const today = new Date().toISOString().slice(0, 10)
  const loadNews = async () => (await fetchPublishedNewsRest(projectId, idToken)).items
  // Un registro por pregunta en los logs de Vercel. Sin el texto de la
  // pregunta, por privacidad: solo su largo.
  const log = (trace: object) =>
    console.log(JSON.stringify({ event: "chat", ...trace, questionChars: req.question.length, ms: Date.now() - started }))

  try {
    const app = getAdminApp()
    if (!app) {
      console.warn("[chat] Sin FIREBASE_SERVICE_ACCOUNT: medidor apagado, modo de prueba (no se llama al modelo)")
      const { response, trace } = await answerQuestion(req, await loadNews(), today, null)
      log(trace)
      return Response.json(response)
    }

    const uid = await verifyUid(app, idToken)
    if (!uid) return noAnswer(401, "unauthenticated")

    const budget = parseBudgetEnv(process.env)
    if (!budget) console.error("[chat] BUDGET_USD / RESERVE_USD faltan o son inválidos: no se llama al modelo")
    const apiKey = process.env.ANTHROPIC_API_KEY
    const generate = apiKey ? anthropicGenerate(apiKey, parseThinkingMode(process.env.CHAT_THINKING)) : null

    const { response, trace } = await meteredAnswer(uid, req, loadNews, {
      store: new FirestoreUsageStore(app),
      generate,
      budget,
      now: new Date(),
      today,
    })
    log(trace)
    return Response.json(response)
  } catch (e) {
    if (e instanceof UnauthenticatedError) return noAnswer(401, "unauthenticated")
    console.error("[chat] Error inesperado", e)
    return noAnswer(500, "error")
  }
}
```

- [ ] **Paso 2: Pruebas, tipos y build**

Run: `npm test -w @respai/mobile`, `npm run typecheck -w @respai/mobile` y `npm run build -w @respai/mobile`
Esperado: pruebas y `tsc` pasan. `next build` compila. Igual que en los ciclos de Rol 2, el build local puede fallar después de compilar solo por la falta de `.env.local`; eso no es un error de este cambio, y se anota tal cual.

- [ ] **Paso 3: Commit (lo hace el usuario)**

Mensaje sugerido: `feat(chat): endpoint con medidor de gasto y Haiku 5.5`. En el PR, avisar a Rol 2.

---

### Tarea 9: Reglas propuestas, variables de entorno y documentación

**Archivos:**
- Modificar: `firestore.rules` (antes del bloque "Todo lo demás, cerrado por defecto")
- Modificar: `apps/mobile/.env.example`
- Modificar: `docs/medidor-gasto.md` (tabla de variables de entorno)
- Modificar: `docs/estado-tecnico.md`, `docs/chat.md`, `docs/ciclos.md`

- [ ] **Paso 1: Reglas propuestas** (las revisa y despliega Rol 4). En `firestore.rules`, justo antes de `// Todo lo demás, cerrado por defecto.`, agregar:

```
    // Medidor de gasto del chat (Rol 5, docs/medidor-gasto.md). Lo escribe
    // solo el servidor con el Admin SDK, que no pasa por estas reglas. Desde
    // el cliente: solo admins leen (tablero del portal).
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

- [ ] **Paso 2: Variables en `apps/mobile/.env.example`** (agregar al final)

```
# --- Solo servidor (Vercel). NUNCA con prefijo NEXT_PUBLIC_. Ver docs/medidor-gasto.md ---
# Sin FIREBASE_SERVICE_ACCOUNT el chat queda en modo de prueba y nunca llama al modelo.
# ANTHROPIC_API_KEY=
# FIREBASE_SERVICE_ACCOUNT=
# BUDGET_USD=20
# RESERVE_USD=10
# CHAT_THINKING=disabled
```

- [ ] **Paso 3: Documentación**
  - `docs/medidor-gasto.md`, tabla "Variables de entorno": agregar la fila `CHAT_THINKING` | `disabled` (por defecto) o `low` | Pensamiento del modelo (RC-08).
  - `docs/estado-tecnico.md`:
    - en la fila "Endpoint del chat", agregar que pasa por el medidor (`lib/meteredChat.ts`) y que el modelo es Haiku 5.5 (`lib/anthropic.ts`), activo solo con `FIREBASE_SERVICE_ACCOUNT`, `ANTHROPIC_API_KEY` y el presupuesto configurados;
    - en "Guía rápida por rol → Rol 5", reemplazar "nada técnico bloqueante" por el estado del medidor;
    - en "Huecos conocidos", quitar la línea vieja de `fallbackFeed` (Rol 4 ya conectó el ranking).
  - `docs/chat.md`, tabla de pasos: la fila "Conectar modelo real + medidor de gasto" pasa a "Hecho en código (Rol 5); falta probar en vivo (Tarea 10)", con un enlace a `docs/medidor-gasto.md`.
  - `docs/ciclos.md`: un ciclo "Medidor de gasto en código" con lo esperado, lo que pasó (cantidad de pruebas, cualquier ajuste de tipos del SDK en la Tarea 6) y lo pendiente (configuración de Rol 4, prueba en vivo).

- [ ] **Paso 4: Commit (lo hace el usuario)**

Mensaje sugerido: `docs(rol5): reglas propuestas, variables y estado del medidor`. En el PR, avisar a Rol 4 de las reglas.

---

### Tarea 10: Verificación en vivo (requiere Rol 4 y la API key)

**Archivos:** ninguno de código. La evidencia va en `docs/evidencia/` y `docs/ciclos.md`.

**Antes:**
- Rol 4 despliega las reglas.
- Rol 4 carga en el proyecto de Vercel de la app: `FIREBASE_SERVICE_ACCOUNT`, `BUDGET_USD=20`, `RESERVE_USD=10` y `ANTHROPIC_API_KEY` (la key la entrega Rol 5 por un canal privado).
- Rol 4 crea `admins/{correo de Rol 5}`.

- [ ] **Paso 1: Una pregunta real.** En el preview del PR, preguntar "Explícame la noticia de las elecciones en España". Esperado: etiqueta "Respuesta generada por IA". En Firebase Console aparece `usage/totals` con `questions.model = 1`, `inputTokens` y `outputTokens` reales y `spentUsd` de unos USD 0,0003. Captura: `docs/evidencia/medidor-primera-llamada.png`.
- [ ] **Paso 2: Pregunta sin noticias.** "¿Qué pasó con el terremoto en Japón?". Esperado: `questions.no_model` sube y `spentUsd` no cambia.
- [ ] **Paso 3: Límite por usuario.** Crear `config/chat` con `{ enabled: true, limits: { perMinute: 2 } }` y hacer 3 preguntas en el mismo minuto. Esperado: la tercera dice "Hiciste muchas preguntas seguidas…" y `rate_limits/{uid}` muestra `minuteCount: 2`.
- [ ] **Paso 4: Interruptor.** Poner `enabled: false` y esperar 30 segundos. Esperado: "El chat está pausado por ahora…". Volver a `true`.
- [ ] **Paso 5: Tope total.** En Vercel, poner temporalmente `RESERVE_USD=19.9999` (tope de USD 0,0001, menor que el peor caso) y volver a desplegar. Esperado: "El chat llegó a su límite de uso…", `questions.budget_blocked` sube y no aparece gasto nuevo en la Consola de Anthropic. **Volver a `RESERVE_USD=10`.**
- [ ] **Paso 6: Conciliación.** Comparar `usage/totals.spentUsd` con la página Usage de la Consola de Anthropic. Captura: `docs/evidencia/medidor-conciliacion.png`. Anotar la diferencia y su causa (pruebas fuera del endpoint, redondeo) en `docs/ciclos.md` y en la tabla de gasto manual de `docs/costos.md`.
- [ ] **Paso 7: Commit (lo hace el usuario)**

Mensaje sugerido: `docs(rol5): evidencia del medidor en vivo`
