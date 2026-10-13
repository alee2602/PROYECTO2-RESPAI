import { test } from "node:test"
import assert from "node:assert/strict"
import { collectPublished, parseNewsData } from "./newsParse.ts"

// Reglas de qué noticia se puede mostrar (las mismas para feed, lector y
// chat). Se extrajeron de lib/news.ts sin cambiar su comportamiento.

const BASE = {
  title: "Título",
  validationStatus: "confirmed",
  scope: "national",
  sources: [{ name: "Fuente", type: "original" }],
  topics: ["política"],
  createdAt: "2026-10-01T00:00:00.000Z",
  publishedAt: "2026-10-02T00:00:00.000Z",
}

test("una noticia completa se lee tal cual", () => {
  const n = parseNewsData("id1", BASE)
  assert.equal(n?.id, "id1")
  assert.equal(n?.publishedAt, "2026-10-02T00:00:00.000Z")
  assert.deepEqual(n?.sources, [{ name: "Fuente", type: "original" }])
})

test("sin estado de validación válido, sin alcance o sin fuentes válidas: no se muestra", () => {
  assert.equal(parseNewsData("x", { ...BASE, validationStatus: "verdadera" }), null)
  assert.equal(parseNewsData("x", { ...BASE, scope: "galactico" }), null)
  assert.equal(parseNewsData("x", { ...BASE, sources: [{ name: "", type: "original" }] }), null)
  assert.equal(parseNewsData("x", { ...BASE, sources: [{ name: "Fuente", type: "rumor" }] }), null)
  assert.equal(parseNewsData("x", { ...BASE, title: "" }), null)
})

test("fechas: acepta un Timestamp del SDK (con toDate) o texto ISO", () => {
  const ts = { toDate: () => new Date("2026-10-05T12:00:00.000Z") }
  assert.equal(parseNewsData("x", { ...BASE, publishedAt: ts })?.publishedAt, "2026-10-05T12:00:00.000Z")
})

test("collectPublished: borradores no cuentan; publicadas inválidas cuentan como ocultas", () => {
  const r = collectPublished([
    { id: "ok", data: BASE },
    { id: "borrador", data: { ...BASE, publishedAt: undefined } },
    { id: "mala", data: { ...BASE, sources: [] } },
  ])
  assert.deepEqual(r.items.map((n) => n.id), ["ok"])
  assert.equal(r.hidden, 1)
})
