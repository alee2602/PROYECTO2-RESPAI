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
