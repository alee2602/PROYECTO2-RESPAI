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
