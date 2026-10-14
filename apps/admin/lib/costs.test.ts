import { test } from "node:test"
import assert from "node:assert/strict"
import {
  DEFAULT_CONFIG,
  DENIED_TEXT,
  WORST_CASE_COST_USD,
  barSegments,
  chatState,
  dayKey,
  docStatusMessage,
  formatUsd,
  hourKey,
  moneySummary,
  parseConfig,
  parseCounters,
  savingsEstimate,
  validateReserveInput,
} from "./costs.ts"

// Tablero de costos (Rol 5): lógica pura, sin Firebase.

// --- config/chat ---------------------------------------------------------------

test("config: sin documento → encendido, reserva 10", () => {
  assert.deepEqual(DEFAULT_CONFIG, { enabled: true, reserveUsd: 10, disabledBy: null })
  assert.deepEqual(parseConfig(null), DEFAULT_CONFIG)
  assert.deepEqual(parseConfig("x"), DEFAULT_CONFIG)
})

test("config: misma regla que la app (false explícito, reserva 0–20, disabledBy conocido)", () => {
  assert.equal(parseConfig({ enabled: "false" }).enabled, true)
  assert.equal(parseConfig({ enabled: false }).enabled, false)
  assert.equal(parseConfig({ reserveUsd: 0 }).reserveUsd, 0)
  assert.equal(parseConfig({ reserveUsd: 25 }).reserveUsd, 10)
  assert.equal(parseConfig({ reserveUsd: "3" }).reserveUsd, 10)
  assert.equal(parseConfig({ enabled: false, disabledBy: "reserve" }).disabledBy, "reserve")
  assert.equal(parseConfig({ enabled: false, disabledBy: "zzz" }).disabledBy, null)
  assert.deepEqual(parseConfig({ limits: { hourlyUsd: 1 } }), DEFAULT_CONFIG)
})

// --- Contadores ------------------------------------------------------------------

test("contadores: documento faltante → todo en 0, exists false, no inválido", () => {
  const c = parseCounters(null)
  assert.equal(c.exists, false)
  assert.equal(c.invalid, false)
  assert.equal(c.spentUsd, 0)
  assert.equal(c.totalQuestions, 0)
})

test("contadores: lee totales y suma solo caminos conocidos (ignora budget_blocked viejo)", () => {
  const c = parseCounters({
    spentUsd: 0.0026, inputTokens: 18000, outputTokens: 1600,
    questions: { model: 20, no_model: 30, rate_limited: 2, budget_blocked: 4 },
  })
  assert.equal(c.exists, true)
  assert.equal(c.invalid, false)
  assert.equal(c.questions.model, 20)
  assert.equal(c.questions.no_model, 30)
  assert.equal(c.questions.disabled, 0)
  assert.equal(c.totalQuestions, 52)
})

test("contadores: campo no numérico o negativo → 0 y marcado inválido", () => {
  const c = parseCounters({ spentUsd: "mucho", inputTokens: -5, questions: { model: "x" } })
  assert.equal(c.invalid, true)
  assert.equal(c.spentUsd, 0)
  assert.equal(c.inputTokens, 0)
  assert.equal(c.questions.model, 0)
})

test("contadores: questions que no es objeto → inválido", () => {
  assert.equal(parseCounters({ spentUsd: 1, questions: 7 }).invalid, true)
})

// --- Dinero --------------------------------------------------------------------

test("dinero: saldo = 20 − gastado; disponible = saldo − reserva", () => {
  const m = moneySummary(2.5, 10)
  assert.deepEqual(m, { budget: 20, spent: 2.5, balance: 17.5, reserve: 10, available: 7.5 })
})

test("dinero: saldo bajo la reserva o gasto mayor a 20 → disponible 0", () => {
  assert.equal(moneySummary(12, 10).available, 0)
  const over = moneySummary(21, 10)
  assert.equal(over.balance, -1)
  assert.equal(over.available, 0)
})

test("barra: los tres tramos suman 100 % cuando el gasto no pasa de 20", () => {
  const s = barSegments(moneySummary(5, 10))
  assert.equal(s.spentPct, 25)
  assert.equal(s.availablePct, 25)
  assert.equal(s.reservePct, 50)
  const s2 = barSegments(moneySummary(15, 10))
  assert.equal(s2.spentPct + s2.availablePct + s2.reservePct, 100)
  assert.equal(s2.availablePct, 0)
})

test("barra: gasto mayor a 20 → 100 % gastado, sin pasarse", () => {
  assert.deepEqual(barSegments(moneySummary(25, 10)), { spentPct: 100, availablePct: 0, reservePct: 0 })
})

// --- Ahorro --------------------------------------------------------------------

test("ahorro: sin preguntas con modelo → sin datos para estimar", () => {
  assert.equal(savingsEstimate(parseCounters({ questions: { no_model: 10 } })), null)
})

test("ahorro: preguntas evitadas × costo promedio real de una con modelo", () => {
  const c = parseCounters({ spentUsd: 0.002, questions: { model: 10, no_model: 6, off_topic: 1, rate_limited: 2, disabled: 1, error: 3 } })
  const s = savingsEstimate(c)
  assert.ok(s)
  assert.ok(Math.abs(s.avgModelCostUsd - 0.0002) < 1e-12)
  assert.equal(s.avoidedQuestions, 10)
  assert.ok(Math.abs(s.savedUsd - 0.002) < 1e-12)
})

// --- Estado del chat -------------------------------------------------------------

test("estado: encendido / apagado por admin / apagado por reserva", () => {
  assert.equal(chatState(DEFAULT_CONFIG, 0).state, "on")
  assert.equal(chatState({ ...DEFAULT_CONFIG, enabled: false, disabledBy: "admin" }, 0).state, "off_admin")
  assert.equal(chatState({ ...DEFAULT_CONFIG, enabled: false, disabledBy: null }, 0).state, "off_admin")
  assert.equal(chatState({ ...DEFAULT_CONFIG, enabled: false, disabledBy: "reserve" }, 0).state, "off_reserve")
})

test("estado: avisa si encenderlo lo volvería a apagar (saldo bajo la reserva)", () => {
  const off = { ...DEFAULT_CONFIG, enabled: false, disabledBy: "reserve" as const }
  assert.equal(chatState(off, 10 - WORST_CASE_COST_USD / 2).wouldReDisable, true)
  assert.equal(chatState(off, 10 - 2 * WORST_CASE_COST_USD).wouldReDisable, false)
  assert.equal(chatState({ ...off, reserveUsd: 0 }, 15).wouldReDisable, false)
})

// --- Campo de la reserva ---------------------------------------------------------

test("reserva: acepta punto o coma, de 0 a 20", () => {
  assert.deepEqual(validateReserveInput("10"), { ok: true, value: 10 })
  assert.deepEqual(validateReserveInput(" 19,9999 "), { ok: true, value: 19.9999 })
  assert.deepEqual(validateReserveInput("0.5"), { ok: true, value: 0.5 })
  assert.deepEqual(validateReserveInput("0"), { ok: true, value: 0 })
  assert.deepEqual(validateReserveInput("20"), { ok: true, value: 20 })
})

test("reserva: vacía, negativa, mayor a 20 o texto → no se envía y explica por qué", () => {
  for (const bad of ["", "   ", "-1", "21", "diez", "1e3", "1,2,3"]) {
    const r = validateReserveInput(bad)
    assert.equal(r.ok, false, bad)
    assert.ok(!r.ok && r.message.length > 5, bad)
  }
})

// --- Estados de lectura ------------------------------------------------------------

test("mensajes de estado: nunca muestran más que el código", () => {
  assert.equal(docStatusMessage({ status: "ok" }, "x"), null)
  assert.equal(docStatusMessage({ status: "loading" }, "x"), "Cargando…")
  assert.equal(docStatusMessage({ status: "missing" }, "Todavía no hay preguntas."), "Todavía no hay preguntas.")
  assert.equal(docStatusMessage({ status: "denied" }, "x"), DENIED_TEXT)
  assert.equal(docStatusMessage({ status: "error", code: "unavailable" }, "x"), "No se pudo leer (unavailable).")
  assert.equal(docStatusMessage({ status: "error" }, "x"), "No se pudo leer (desconocido).")
})

// --- Formato y claves ------------------------------------------------------------

test("montos: 4 decimales bajo USD 1, 2 decimales desde USD 1", () => {
  assert.equal(formatUsd(0.000425), "USD 0.0004")
  assert.equal(formatUsd(0.0026), "USD 0.0026")
  assert.equal(formatUsd(17.5), "USD 17.50")
  assert.equal(formatUsd(-1), "USD -1.00")
})

test("claves de día y hora en UTC, igual que la app", () => {
  const d = new Date("2026-10-13T23:59:30-06:00")
  assert.equal(dayKey(d), "2026-10-14")
  assert.equal(hourKey(d), "2026-10-14T05")
})
