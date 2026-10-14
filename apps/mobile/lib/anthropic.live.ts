import { test } from "node:test"
import assert from "node:assert/strict"
import Anthropic from "@anthropic-ai/sdk"
import type { News } from "@respai/shared"
import { anthropicGenerate } from "./anthropic.ts"
import { answerQuestion, type Generate, type ModelUsage } from "./chatPipeline.ts"
import type { UserLocation } from "./locations.ts"
import { costUsd } from "./pricing.ts"

// ---------------------------------------------------------------------------
// Pruebas EN VIVO contra la API de Anthropic (Rol 5). A diferencia de
// anthropic.test.ts, aquí SÍ hay red y SÍ se gasta (centavos de centavo).
// Prueban que, con la API key correcta, el chat de verdad responde.
//
// No corren con `npm test` (el archivo no termina en .test.ts). Se corren a
// mano: `npm run test:live` (lee ANTHROPIC_API_KEY de .env / .env.local).
// Costo: 2 llamadas a Haiku 5.5, < USD 0,001 en total. Ver docs/costos.md.
// Esta llamada NO pasa por el medidor de Firestore: no aparece en /costos.
// ---------------------------------------------------------------------------

const API_KEY = process.env.ANTHROPIC_API_KEY
const skip = API_KEY ? false : "falta ANTHROPIC_API_KEY (ver .env.example)"

const spent: ModelUsage[] = []
function tracked(generate: Generate): Generate {
  return async (prompt) => {
    const out = await generate(prompt)
    spent.push(out.usage)
    return out
  }
}
const live = () => tracked(anthropicGenerate(API_KEY!, "disabled"))

function makeNews(n: Partial<News> & Pick<News, "id" | "title">): News {
  return {
    summary: "",
    body: "",
    sources: [{ name: "Fuente de prueba", type: "original" }],
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
  makeNews({
    id: "argentina", title: "Bajan la proyección de crecimiento de Argentina", country: "Argentina",
    topics: ["economía"], validationStatus: "in_progress",
  }),
]
const XELA: UserLocation = { country: "Guatemala", region: "Quetzaltenango" }
const TODAY = "2026-10-14"

test("una API key inválida se rechaza con 401 (no cobra)", { skip }, async () => {
  const bad = anthropicGenerate("sk-ant-api03-clave-invalida", "disabled")
  await assert.rejects(
    bad({ system: "Responde OK.", user: "OK", maxOutputTokens: 5, estimatedInputTokens: 5 }),
    Anthropic.AuthenticationError
  )
})

test("la API key real responde con el modelo y los parámetros del chat", { skip }, async () => {
  const out = await live()({
    system: "Responde solo con la palabra: listo",
    user: "¿Estás ahí?",
    maxOutputTokens: 20,
    estimatedInputTokens: 10,
  })
  assert.ok(out.text.length > 0, "devuelve texto")
  assert.ok(out.usage.inputTokens > 0 && out.usage.outputTokens > 0, "devuelve uso real de tokens")
})

test("de punta a punta: el flujo del chat llama al modelo real y devuelve su respuesta", { skip }, async () => {
  const { response, trace } = await answerQuestion(
    { question: "Explícame las elecciones en España", location: XELA }, NEWS, TODAY, live()
  )
  assert.equal(trace.path, "model", "la pregunta llegó al modelo")
  assert.equal(response.kind, "answer")
  if (response.kind !== "answer") return
  assert.equal(response.generatedBy, "model")
  assert.ok(response.text.length > 0, "devuelve texto")
  assert.ok(trace.usage && trace.usage.inputTokens > 0 && trace.usage.outputTokens > 0, "registra tokens reales")
})

test.after(() => {
  if (spent.length === 0) return
  const total = spent.reduce((s, u) => s + costUsd(u), 0)
  console.log(`[live] ${spent.length} llamadas pagadas, costo estimado USD ${total.toFixed(6)}`)
})
