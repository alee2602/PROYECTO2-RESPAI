import { test } from "node:test"
import assert from "node:assert/strict"
import { costUsd } from "./pricing.ts"
import { dayKey, hourKey } from "./usage.ts"
import { MemoryUsageStore } from "./usageStore.ts"

const NOW = new Date("2026-10-13T15:04:05Z")
const LIMITS = { perMinute: 2, perDay: 40 }
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

test("getTotalSpend: el gasto acumulado (0 al empezar)", async () => {
  const s = new MemoryUsageStore()
  assert.equal(await s.getTotalSpend(), 0)
  await s.record({ path: "model", usage: USAGE }, NOW)
  assert.equal(await s.getTotalSpend(), costUsd(USAGE))
})

test("disableChat: apaga por reserva y deja constancia", async () => {
  const s = new MemoryUsageStore()
  await s.disableChat("reserve")
  assert.equal(s.config.enabled, false)
  assert.equal(s.config.disabledBy, "reserve")
  assert.equal(s.disableWrites, 1)
})

test("disableChat idempotente: 3 a la vez → una sola escritura real", async () => {
  const s = new MemoryUsageStore()
  await Promise.all([1, 2, 3].map(() => s.disableChat("reserve")))
  assert.equal(s.disableWrites, 1)
  assert.equal(s.config.enabled, false)
})

test("disableChat con el chat ya apagado por un admin: no cambia nada", async () => {
  const s = new MemoryUsageStore()
  s.config = { ...s.config, enabled: false, disabledBy: "admin" }
  await s.disableChat("reserve")
  assert.equal(s.disableWrites, 0)
  assert.equal(s.config.disabledBy, "admin")
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
