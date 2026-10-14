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
