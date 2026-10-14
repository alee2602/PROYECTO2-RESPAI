import { test } from "node:test"
import assert from "node:assert/strict"
import { WORST_CASE_COST_USD, costUsd } from "./pricing.ts"
import {
  BUDGET_USD,
  DEFAULT_CONFIG,
  DEFAULT_RESERVE_USD,
  PaidModelError,
  USAGE_PATHS,
  USER_LIMITS,
  addCounters,
  countersDelta,
  dayKey,
  decideRateLimit,
  decideReserve,
  emptyCounters,
  hourKey,
  incrementFields,
  minuteKey,
  parseChatConfig,
  parseRateLimitState,
} from "./usage.ts"

const LIMITS = { perMinute: 2, perDay: 3 }

// --- Claves de tiempo (UTC) ------------------------------------------------

test("claves de día, hora y minuto en UTC", () => {
  const d = new Date("2026-10-13T23:59:30-06:00") // Guatemala → 2026-10-14 05:59 UTC
  assert.equal(dayKey(d), "2026-10-14")
  assert.equal(hourKey(d), "2026-10-14T05")
  assert.equal(minuteKey(d), "2026-10-14T05:59")
})

// --- Contadores ------------------------------------------------------------

test("caminos: sin budget_blocked (la reserva cuenta como disabled)", () => {
  assert.deepEqual([...USAGE_PATHS], ["model", "no_model", "off_topic", "rate_limited", "disabled", "simulated", "error"])
})

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

// --- Presupuesto, límites y config/chat --------------------------------------

test("presupuesto fijo USD 20, reserva por defecto USD 10, límites provisionales 5/min y 20/día", () => {
  assert.equal(BUDGET_USD, 20)
  assert.equal(DEFAULT_RESERVE_USD, 10)
  assert.deepEqual(USER_LIMITS, { perMinute: 5, perDay: 20 })
})

test("config: sin documento → encendido, reserva 10, sin quién lo apagó", () => {
  assert.deepEqual(DEFAULT_CONFIG, { enabled: true, reserveUsd: 10, disabledBy: null })
  assert.deepEqual(parseChatConfig(null), DEFAULT_CONFIG)
  assert.deepEqual(parseChatConfig(undefined), DEFAULT_CONFIG)
  assert.deepEqual(parseChatConfig("basura"), DEFAULT_CONFIG)
})

test("config: solo un false explícito apaga el chat", () => {
  assert.equal(parseChatConfig({ enabled: false }).enabled, false)
  assert.equal(parseChatConfig({}).enabled, true)
  assert.equal(parseChatConfig({ enabled: "false" }).enabled, true)
})

test("config: reserva válida entre 0 y 20; si no, 10", () => {
  assert.equal(parseChatConfig({ reserveUsd: 0 }).reserveUsd, 0)
  assert.equal(parseChatConfig({ reserveUsd: 20 }).reserveUsd, 20)
  assert.equal(parseChatConfig({ reserveUsd: 19.9999 }).reserveUsd, 19.9999)
  assert.equal(parseChatConfig({ reserveUsd: -1 }).reserveUsd, 10)
  assert.equal(parseChatConfig({ reserveUsd: 21 }).reserveUsd, 10)
  assert.equal(parseChatConfig({ reserveUsd: Number.NaN }).reserveUsd, 10)
  assert.equal(parseChatConfig({ reserveUsd: "5" }).reserveUsd, 10)
})

test("config: disabledBy solo 'admin' o 'reserve'; lo demás es null", () => {
  assert.equal(parseChatConfig({ enabled: false, disabledBy: "reserve" }).disabledBy, "reserve")
  assert.equal(parseChatConfig({ enabled: false, disabledBy: "admin" }).disabledBy, "admin")
  assert.equal(parseChatConfig({ enabled: false, disabledBy: "otro" }).disabledBy, null)
})

test("config vieja con limits/hourlyUsd: se ignoran sin romper nada", () => {
  const c = parseChatConfig({ enabled: true, limits: { perMinute: 2, hourlyUsd: 1 } })
  assert.deepEqual(c, DEFAULT_CONFIG)
})

// --- Regla de la reserva -----------------------------------------------------

test("reserva: con margen para una llamada más, se permite", () => {
  assert.equal(decideReserve(10 - 2 * WORST_CASE_COST_USD, 10), true)
})

test("reserva: si el peor caso la cruzaría, no se permite", () => {
  assert.equal(decideReserve(10 - WORST_CASE_COST_USD / 2, 10), false)
})

test("reserva 0 (levantada en la demo): se puede gastar casi todo", () => {
  assert.equal(decideReserve(0, 0), true)
  assert.equal(decideReserve(19.99, 0), true)
  assert.equal(decideReserve(20, 0), false)
})

test("reserva 20 o 19,9999 (prueba en vivo): nunca se permite", () => {
  assert.equal(decideReserve(0, 20), false)
  assert.equal(decideReserve(0, 19.9999), false)
})

// --- Límite por usuario -------------------------------------------------------

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
