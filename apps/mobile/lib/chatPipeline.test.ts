import { test } from "node:test"
import assert from "node:assert/strict"
import type { News } from "@respai/shared"
import type { UserLocation } from "./locations.ts"
import { SIMULATED_PREFIX, answerQuestion, type Generate } from "./chatPipeline.ts"

// Pruebas de punta a punta del chat (paso 5), sin red y sin gastar: el
// "modelo" es una función falsa. Ver docs/chat.md.

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
  makeNews({
    id: "argentina", title: "Bajan la proyección de crecimiento de Argentina", country: "Argentina",
    topics: ["economía"], validationStatus: "in_progress", validationNote: "Fuentes contradictorias.",
  }),
]

const XELA: UserLocation = { country: "Guatemala", region: "Quetzaltenango" }
const TODAY = "2026-10-13"
const ask = (question: string, generate: Generate | null = null) =>
  answerQuestion({ question, location: XELA }, NEWS, TODAY, generate)

// Modelo falso: registra si lo llamaron y devuelve un texto fijo.
function fakeModel(text: string) {
  const calls: string[] = []
  const generate: Generate = async (prompt) => {
    calls.push(prompt.user)
    return { text, usage: { inputTokens: 900, outputTokens: 80 } }
  }
  return { generate, calls }
}

test("sin noticias: responde sin llamar al modelo ($0)", async () => {
  const model = fakeModel("no debería usarse")
  const { response, trace } = await ask("¿Qué pasó con el terremoto en Japón?", model.generate)
  assert.equal(response.kind, "no_answer")
  assert.equal(trace.path, "no_model")
  assert.equal(trace.reason, "no_news")
  assert.equal(model.calls.length, 0, "el modelo no se llama")
})

test("saludo: responde sin llamar al modelo", async () => {
  const model = fakeModel("no debería usarse")
  const { trace } = await ask("hola", model.generate)
  assert.equal(trace.reason, "empty_question")
  assert.equal(model.calls.length, 0)
})

test("modo de prueba (sin modelo): responde con las noticias, lo dice y trae citas reales", async () => {
  const { response, trace } = await ask("Explícame las elecciones en España")
  assert.equal(trace.path, "simulated")
  assert.equal(response.kind, "answer")
  if (response.kind !== "answer") return
  assert.equal(response.generatedBy, "rules", "no se presenta como respuesta de IA")
  assert.ok(response.text.startsWith(SIMULATED_PREFIX))
  assert.match(response.text, /\[1\] Pedro Sánchez adelanta elecciones en España \(Confirmada\)/)
  assert.equal(response.citations[0].newsId, "espana")
  assert.ok((trace.estimatedInputTokens ?? 0) > 0)
})

test("modo de prueba: la nota de incertidumbre aparece igual que con modelo", async () => {
  const { response } = await ask("crecimiento de Argentina")
  assert.equal(response.kind, "answer")
  if (response.kind !== "answer") return
  assert.match(response.uncertainty ?? "", /En desarrollo/)
})

test("con modelo: usa su texto, marca 'model' y registra el uso de tokens", async () => {
  const model = fakeModel("Las elecciones en España serán el 29 de noviembre [1].")
  const { response, trace } = await ask("Explícame las elecciones en España", model.generate)
  assert.equal(model.calls.length, 1)
  assert.match(model.calls[0], /<pregunta>Explícame las elecciones en España<\/pregunta>/)
  assert.equal(response.kind, "answer")
  if (response.kind !== "answer") return
  assert.equal(response.generatedBy, "model")
  assert.equal(response.text, "Las elecciones en España serán el 29 de noviembre [1].")
  assert.deepEqual(trace.usage, { inputTokens: 900, outputTokens: 80 })
  assert.equal(trace.path, "model")
})

test("con modelo: las citas salen de las noticias, no del texto del modelo", async () => {
  // Aunque el modelo invente una fuente en su texto, las citas que ve la
  // persona son las de las noticias recuperadas.
  const model = fakeModel("Según El Diario Inventado [1], ya votaron.")
  const { response } = await ask("Explícame las elecciones en España", model.generate)
  if (response.kind !== "answer") return assert.fail("debería responder")
  assert.equal(response.citations.length, 1)
  assert.equal(response.citations[0].sources[0].name, "Fuente")
})

test("con modelo: se quitan las citas a noticias que no existen", async () => {
  const model = fakeModel("Serán en noviembre [1] y hubo un debate [7].")
  const { response, trace } = await ask("Explícame las elecciones en España", model.generate)
  if (response.kind !== "answer") return assert.fail("debería responder")
  assert.equal(response.text, "Serán en noviembre [1] y hubo un debate.")
  assert.deepEqual(trace.droppedCitations, [7])
})
