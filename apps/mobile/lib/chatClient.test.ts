import { test } from "node:test"
import assert from "node:assert/strict"
import { askChat } from "./chatClient.ts"

// Pruebas de la llamada del celular al endpoint (paso 6). `fetch` falso: sin red.

const LOC = { country: "Guatemala", region: "Quetzaltenango" }

function fakeFetch(status: number, body: unknown, seen?: { url?: string; init?: RequestInit }) {
  return (async (url: string | URL | Request, init?: RequestInit) => {
    if (seen) Object.assign(seen, { url: String(url), init })
    return new Response(typeof body === "string" ? body : JSON.stringify(body), { status })
  }) as typeof fetch
}

test("manda la pregunta, la ubicación y el token del usuario", async () => {
  const seen: { url?: string; init?: RequestInit } = {}
  const ok = { kind: "no_answer", reason: "no_news", text: "No encontré noticias." }
  const r = await askChat("¿Qué pasó?", LOC, "mi-token", fakeFetch(200, ok, seen))
  assert.deepEqual(r, ok)
  assert.equal(seen.url, "/api/chat")
  assert.equal(seen.init?.method, "POST")
  assert.equal(new Headers(seen.init?.headers).get("Authorization"), "Bearer mi-token")
  assert.deepEqual(JSON.parse(String(seen.init?.body)), { question: "¿Qué pasó?", location: LOC })
})

test("devuelve la respuesta del servidor tal cual (con citas)", async () => {
  const answer = { kind: "answer", text: "Texto [1]", citations: [], uncertainty: null, generatedBy: "rules" }
  assert.deepEqual(await askChat("x", LOC, "t", fakeFetch(200, answer)), answer)
})

test("sesión vencida (401 del servidor): respuesta 'unauthenticated' con mensaje claro", async () => {
  const r = await askChat("x", LOC, "t", fakeFetch(401, { kind: "no_answer", reason: "unauthenticated", text: "Tu sesión expiró." }))
  assert.equal(r.kind, "no_answer")
  if (r.kind === "no_answer") assert.equal(r.reason, "unauthenticated")
})

test("error del servidor sin JSON: mensaje claro, no un error técnico", async () => {
  const r = await askChat("x", LOC, "t", fakeFetch(500, "<html>Internal Server Error</html>"))
  assert.equal(r.kind, "no_answer")
  if (r.kind === "no_answer") {
    assert.equal(r.reason, "error")
    assert.doesNotMatch(r.text, /html|500|Internal/)
  }
})

test("sin red: no lanza, devuelve un mensaje claro", async () => {
  const offline = (async () => {
    throw new TypeError("Failed to fetch")
  }) as typeof fetch
  const r = await askChat("x", LOC, "t", offline)
  assert.equal(r.kind, "no_answer")
  if (r.kind === "no_answer") assert.equal(r.reason, "error")
})
