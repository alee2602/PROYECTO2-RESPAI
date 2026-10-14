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
