import { test } from "node:test"
import assert from "node:assert/strict"
import {
  UnauthenticatedError,
  documentId,
  fetchPublishedNewsRest,
  fromFirestoreFields,
  type FirestoreValue,
} from "./firestoreRest.ts"

// Pruebas de la lectura de noticias desde el servidor (paso 5). `fetch` se
// reemplaza por uno falso: no hay red.

// Documento como lo devuelve la API REST de Firestore.
function restDoc(id: string, fields: Record<string, FirestoreValue>) {
  return { name: `projects/p/databases/(default)/documents/news/${id}`, fields }
}

const PUBLISHED: Record<string, FirestoreValue> = {
  title: { stringValue: "Pedro Sánchez adelanta elecciones" },
  summary: { stringValue: "Serán el 29 de noviembre." },
  validationStatus: { stringValue: "confirmed" },
  scope: { stringValue: "national" },
  country: { stringValue: "España" },
  topics: { arrayValue: { values: [{ stringValue: "política" }] } },
  sources: {
    arrayValue: {
      values: [
        { mapValue: { fields: { name: { stringValue: "CRHoy/AFP" }, type: { stringValue: "original" }, url: { stringValue: "https://crhoy.com/x" } } } },
      ],
    },
  },
  createdAt: { timestampValue: "2026-10-09T15:00:00Z" },
  publishedAt: { timestampValue: "2026-10-09T16:00:00Z" },
}

async function withFakeFetch<T>(responses: { status: number; body?: unknown }[], fn: (urls: string[]) => Promise<T>) {
  const original = globalThis.fetch
  const urls: string[] = []
  let i = 0
  globalThis.fetch = (async (url: string | URL | Request) => {
    urls.push(String(url))
    const r = responses[Math.min(i++, responses.length - 1)]
    return new Response(JSON.stringify(r.body ?? {}), { status: r.status })
  }) as typeof fetch
  try {
    return await fn(urls)
  } finally {
    globalThis.fetch = original
  }
}

test("convierte campos REST a valores simples (texto, fechas ISO, listas, mapas)", () => {
  const data = fromFirestoreFields(PUBLISHED)
  assert.equal(data.title, "Pedro Sánchez adelanta elecciones")
  assert.equal(data.publishedAt, "2026-10-09T16:00:00Z")
  assert.deepEqual(data.topics, ["política"])
  assert.deepEqual(data.sources, [{ name: "CRHoy/AFP", type: "original", url: "https://crhoy.com/x" }])
  assert.deepEqual(fromFirestoreFields({ n: { integerValue: "3" }, b: { booleanValue: true }, z: { nullValue: null } }), {
    n: 3, b: true, z: null,
  })
})

test("documentId toma el último tramo del nombre", () => {
  assert.equal(documentId("projects/p/databases/(default)/documents/news/abc123"), "abc123")
})

test("devuelve solo publicadas válidas: borradores fuera, sin fuentes = oculta", async () => {
  const draft = { ...PUBLISHED }
  delete draft.publishedAt
  const noSources = { ...PUBLISHED, sources: { arrayValue: { values: [] } } }
  const result = await withFakeFetch(
    [{ status: 200, body: { documents: [restDoc("ok", PUBLISHED), restDoc("draft", draft), restDoc("bad", noSources)] } }],
    () => fetchPublishedNewsRest("p", "token")
  )
  assert.deepEqual(result.items.map((n) => n.id), ["ok"])
  assert.equal(result.hidden, 1, "la publicada sin fuentes cuenta como oculta; el borrador no")
  assert.equal(result.items[0].publishedAt, "2026-10-09T16:00:00Z")
})

test("manda el token del usuario y sigue las páginas", async () => {
  const seenAuth: string[] = []
  const original = globalThis.fetch
  let call = 0
  globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
    seenAuth.push(new Headers(init?.headers).get("Authorization") ?? "")
    call++
    const body = call === 1
      ? { documents: [restDoc("a", PUBLISHED)], nextPageToken: "pagina2" }
      : { documents: [restDoc("b", PUBLISHED)] }
    return new Response(JSON.stringify(body), { status: 200 })
  }) as typeof fetch
  try {
    const result = await fetchPublishedNewsRest("p", "mi-token")
    assert.deepEqual(result.items.map((n) => n.id), ["a", "b"])
    assert.deepEqual(seenAuth, ["Bearer mi-token", "Bearer mi-token"])
  } finally {
    globalThis.fetch = original
  }
})

test("token inválido o vencido (401) o rechazado por las reglas (403): UnauthenticatedError", async () => {
  for (const status of [401, 403]) {
    await withFakeFetch([{ status }], async () => {
      await assert.rejects(fetchPublishedNewsRest("p", "malo"), UnauthenticatedError)
    })
  }
})

test("otro error de Firestore: se propaga (el endpoint responde 'error')", async () => {
  await withFakeFetch([{ status: 500 }], async () => {
    await assert.rejects(fetchPublishedNewsRest("p", "token"), (e: unknown) => !(e instanceof UnauthenticatedError))
  })
})

test("colección vacía: no revienta", async () => {
  const result = await withFakeFetch([{ status: 200, body: {} }], () => fetchPublishedNewsRest("p", "token"))
  assert.deepEqual(result, { items: [], hidden: 0 })
})
