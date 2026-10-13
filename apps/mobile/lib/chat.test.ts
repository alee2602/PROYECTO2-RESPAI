import { test } from "node:test"
import assert from "node:assert/strict"
import type { News } from "@respai/shared"
import type { UserLocation } from "./locations.ts"
import { retrieveNews } from "./retrieval.ts"
import {
  CHAT_LIMITS,
  answerWithoutModel,
  buildCitations,
  parseChatRequest,
  uncertaintyNote,
} from "./chat.ts"

// Pruebas del contrato del chat (paso 2) y de las respuestas sin modelo
// (paso 3). Ver docs/chat.md.

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
    sources: [{ name: "CRHoy/AFP", url: "https://crhoy.com/x", type: "original" }],
    publishedAt: "2026-10-09T00:00:00.000Z",
  }),
  makeNews({
    id: "argentina", title: "Bajan la proyección de crecimiento de Argentina", country: "Argentina",
    topics: ["economía"], validationStatus: "in_progress",
    validationNote: "Fuentes contradictorias: la cifra final no está confirmada.",
  }),
  makeNews({
    id: "caimi", title: "CAIMI de Antigua Guatemala sin avanzar", country: "Guatemala", region: "Sacatepéquez",
    scope: "local", topics: ["salud"], validationStatus: "unverified",
  }),
]

const XELA: UserLocation = { country: "Guatemala", region: "Quetzaltenango" }
const ask = (q: string) => retrieveNews(q, NEWS, XELA)

// --- parseChatRequest -------------------------------------------------------

test("parseChatRequest acepta una pregunta con ubicación válida y recorta espacios", () => {
  assert.deepEqual(parseChatRequest({ question: "  ¿Qué pasó hoy?  ", location: { country: "Guatemala", region: null } }), {
    question: "¿Qué pasó hoy?",
    location: { country: "Guatemala", region: null },
  })
})

test("parseChatRequest rechaza cuerpos mal formados", () => {
  assert.equal(parseChatRequest(null), null)
  assert.equal(parseChatRequest("hola"), null)
  assert.equal(parseChatRequest({ question: 42, location: { country: "Guatemala" } }), null)
  assert.equal(parseChatRequest({ question: "hola" }), null, "sin ubicación no se puede personalizar")
  assert.equal(parseChatRequest({ question: "hola", location: { country: "" } }), null)
})

// --- Citas e incertidumbre --------------------------------------------------

test("las citas salen de las noticias recuperadas, con fuentes y estado en español", () => {
  const [c] = buildCitations(ask("elecciones en España"))
  assert.equal(c.newsId, "espana")
  assert.equal(c.validationLabel, "Confirmada")
  assert.deepEqual(c.sources, [{ name: "CRHoy/AFP", url: "https://crhoy.com/x", type: "original" }])
  assert.equal(c.publishedAt, "2026-10-09T00:00:00.000Z")
})

test("la cita conserva la nota de validación (por qué no está confirmada)", () => {
  const [c] = buildCitations(ask("crecimiento de Argentina"))
  assert.equal(c.validationLabel, "En desarrollo")
  assert.match(c.validationNote ?? "", /contradictorias/)
})

test("incertidumbre: todo confirmado y nada faltante → sin nota", () => {
  const r = ask("elecciones en España")
  assert.equal(uncertaintyNote(buildCitations(r), r.unmatchedTerms), null)
})

test("incertidumbre: nombra lo que está en desarrollo y lo no verificado", () => {
  const citations = buildCitations({ ...ask("x"), items: NEWS.map((news) => ({ news, score: 1, why: [] })) })
  const note = uncertaintyNote(citations, [])!
  assert.match(note, /En desarrollo.*Argentina/)
  assert.match(note, /No verificada.*CAIMI/)
  assert.doesNotMatch(note, /España/, "lo confirmado no va en la nota")
})

test("incertidumbre: avisa lo que se preguntó y no está publicado", () => {
  const r = ask("¿Hubo un terremoto en España?")
  const note = uncertaintyNote(buildCitations(r), r.unmatchedTerms)!
  assert.match(note, /«terremoto»/)
  assert.match(note, /no puedo confirmar/)
})

// --- Respuestas sin modelo (paso 3) ----------------------------------------

test("sin noticias: responde sin modelo y dice que no puede confirmarlo", () => {
  const q = "¿Qué pasó con el terremoto en Japón?"
  const res = answerWithoutModel(q, ask(q))
  assert.equal(res?.kind, "no_answer")
  assert.equal(res?.reason, "no_news")
  assert.match(res!.text, /«terremoto», «japon»/)
  assert.match(res!.text, /No puedo confirmarlo/)
})

test("saludo o pregunta vacía: responde sin modelo con ejemplos", () => {
  for (const q of ["", "   ", "hola", "¿qué tal?", "gracias"]) {
    const res = answerWithoutModel(q, ask(q))
    assert.equal(res?.reason, "empty_question", `"${q}" debería contar como vacía`)
    assert.match(res!.text, /Prueba con algo como/)
  }
})

test("pregunta demasiado larga: responde sin modelo (protege el costo)", () => {
  const q = "elecciones ".repeat(40)
  assert.ok(q.length > CHAT_LIMITS.maxQuestionChars)
  assert.equal(answerWithoutModel(q, ask(q))?.reason, "too_long")
})

test("con noticias relevantes: hace falta el modelo (devuelve null)", () => {
  for (const q of ["Explícame las elecciones en España", "¿Qué pasó hoy?", "¿Qué hay en mi país?"]) {
    assert.equal(answerWithoutModel(q, ask(q)), null, `"${q}" debería ir al modelo`)
  }
})

test("algo no publicado en un país que sí existe: va al modelo, pero con la nota de lo que falta", () => {
  // No se corta sin modelo (hay una noticia de España que sí es pertinente),
  // pero la nota de incertidumbre, armada por código, ya avisa del terremoto.
  const q = "¿Hubo un terremoto en España?"
  const r = ask(q)
  assert.equal(answerWithoutModel(q, r), null)
  assert.deepEqual(r.unmatchedTerms, ["terremoto"])
})
