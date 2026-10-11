import { test } from "node:test"
import assert from "node:assert/strict"
import { AFFINITY, computeTopicAffinity, newsAffinity, normalizeTopic, type SignalInput } from "./affinity.ts"

// Cómo se convierten las señales (docs/senales.md) en interés por tema.

const read = (newsId: string, topics: string[], durationMs: number): SignalInput => ({
  type: "read_time",
  newsId,
  topics,
  durationMs,
})
const open = (newsId: string, topics: string[]): SignalInput => ({ type: "open", newsId, topics })
const share = (newsId: string, topics: string[]): SignalInput => ({ type: "share", newsId, topics })

test("sin señales no hay afinidad", () => {
  assert.equal(computeTopicAffinity([]).size, 0)
})

test("varios read_time de la misma apertura se suman por noticia (y se topan en una lectura completa)", () => {
  // 3 × 40 s = 2 min, pero una noticia aporta como mucho 1 lectura completa.
  const a = computeTopicAffinity([read("n1", ["deportes"], 40_000), read("n1", ["deportes"], 40_000), read("n1", ["deportes"], 40_000)])
  const full = 1 / (1 + AFFINITY.halfSaturation)
  assert.equal(a.get("deportes"), full)
})

test("un open sin lectura pesa mucho menos que una lectura completa", () => {
  const soloOpen = computeTopicAffinity([open("n1", ["economia"])]).get("economia")!
  const leida = computeTopicAffinity([open("n1", ["economia"]), read("n1", ["economia"], 60_000)]).get("economia")!
  assert.ok(soloOpen > 0, "abrir sí cuenta un poco")
  assert.ok(leida > soloOpen * 3, "leer cuenta bastante más que solo abrir")
})

test("compartir suma más interés que solo leer", () => {
  const leida = computeTopicAffinity([read("n1", ["salud"], 60_000)]).get("salud")!
  const compartida = computeTopicAffinity([read("n1", ["salud"], 60_000), share("n1", ["salud"])]).get("salud")!
  assert.ok(compartida > leida)
})

test("más noticias leídas de un tema = más afinidad, pero nunca llega a 1", () => {
  const una = computeTopicAffinity([read("n1", ["espacio"], 60_000)]).get("espacio")!
  const diez = computeTopicAffinity(
    Array.from({ length: 10 }, (_, i) => read(`n${i}`, ["espacio"], 60_000))
  ).get("espacio")!
  assert.ok(diez > una)
  assert.ok(diez < 1)
})

test("los temas se comparan sin tildes ni mayúsculas", () => {
  assert.equal(normalizeTopic(" Economía "), "economia")
  const a = computeTopicAffinity([read("n1", ["Economía"], 60_000)])
  assert.ok(newsAffinity(["economia"], a).value > 0)
})

test("newsAffinity usa el tema más afín de la noticia (máximo, no suma)", () => {
  const a = computeTopicAffinity([read("n1", ["deportes"], 60_000), read("n2", ["clima"], 10_000)])
  const r = newsAffinity(["clima", "deportes"], a)
  assert.equal(r.topic, "deportes")
  assert.equal(r.value, a.get("deportes"))
})

test("señales raras (tipo desconocido, sin newsId, duración negativa) se ignoran", () => {
  const a = computeTopicAffinity([
    { type: "otro", newsId: "n1", topics: ["x"] },
    { type: "read_time", newsId: "", topics: ["x"], durationMs: 60_000 },
    { type: "read_time", newsId: "n2", topics: ["x"], durationMs: -5 },
  ])
  assert.equal(a.size, 0)
})
