import { test } from "node:test"
import assert from "node:assert/strict"
import type { News } from "@respai/shared"
import type { UserLocation } from "./locations.ts"
import { rankNewsByLocation } from "./ranking.ts"

// Pruebas del criterio de aceptación de Rol 4 (docs/roles-equipo.md):
// "Para cada ubicación simulada, el top del feed incluye local, nacional e
// internacional cuando existen" y "un usuario muy aficionado a un tema sigue
// viendo noticias importantes de otros alcances" (acá probado vía ubicación,
// que es la única señal que usa este ranking en Etapa 1).

let counter = 0
function makeNews(overrides: Partial<News>): News {
  counter += 1
  return {
    id: overrides.id ?? `n${counter}`,
    title: `Noticia ${counter}`,
    summary: "",
    body: "",
    sources: [{ name: "Fuente de prueba", type: "original" }],
    authorId: "test",
    validationStatus: "confirmed",
    scope: "local",
    topics: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  }
}

const GUATE: UserLocation = { country: "Guatemala", region: "Quetzaltenango" }

test("el top del feed incluye local, nacional e internacional cuando existen los tres", () => {
  const news = [
    // Nada de esto coincide con la ubicación del usuario -> sin protección
    // anti-burbuja, ninguna de estas tres entraría arriba.
    makeNews({ id: "local-lejos", scope: "local", country: "México", region: "Jalisco" }),
    makeNews({ id: "nacional-lejos", scope: "national", country: "España" }),
    makeNews({ id: "intl-lejos", scope: "international", country: "Argentina" }),
    // Seis noticias que sí coinciden con la ubicación, todas "mejores" por
    // puntaje que las tres de arriba -> sin protección, llenarían el top.
    ...Array.from({ length: 6 }, (_, i) =>
      makeNews({
        id: `cercana-${i}`,
        scope: "local",
        country: "Guatemala",
        region: "Quetzaltenango",
        createdAt: `2026-0${(i % 9) + 1}-01T00:00:00.000Z`,
      })
    ),
  ]

  const { items } = rankNewsByLocation(news, GUATE)
  const top6 = items.slice(0, 6).map((n) => n.scope)

  assert.ok(top6.includes("local"), "falta 'local' en el top del feed")
  assert.ok(top6.includes("national"), "falta 'national' en el top del feed")
  assert.ok(top6.includes("international"), "falta 'international' en el top del feed")
})

test("no esconde ninguna noticia: la protección reordena, no elimina", () => {
  const news = [
    makeNews({ id: "a", scope: "local", country: "Guatemala", region: "Quetzaltenango" }),
    makeNews({ id: "b", scope: "national", country: "España" }),
    makeNews({ id: "c", scope: "international", country: "Argentina" }),
  ]
  const { items } = rankNewsByLocation(news, GUATE)
  assert.equal(items.length, news.length)
  assert.deepEqual(
    new Set(items.map((n) => n.id)),
    new Set(news.map((n) => n.id))
  )
})

test("sin protección necesaria, ordena por cercanía y luego por fecha reciente primero", () => {
  const news = [
    makeNews({ id: "vieja", scope: "local", country: "Guatemala", region: "Quetzaltenango", createdAt: "2026-01-01T00:00:00.000Z" }),
    makeNews({ id: "nueva", scope: "local", country: "Guatemala", region: "Quetzaltenango", createdAt: "2026-06-01T00:00:00.000Z" }),
    makeNews({ id: "otro-pais", scope: "local", country: "México", region: "Jalisco", createdAt: "2026-12-01T00:00:00.000Z" }),
  ]
  const { items } = rankNewsByLocation(news, GUATE)
  assert.deepEqual(items.map((n) => n.id), ["nueva", "vieja", "otro-pais"])
})

test("si un alcance no existe en ninguna noticia, no revienta ni lo inventa", () => {
  const news = [
    makeNews({ id: "a", scope: "local", country: "Guatemala", region: "Quetzaltenango" }),
    makeNews({ id: "b", scope: "local", country: "Guatemala", region: "Petén" }),
  ]
  const { items, protectedIds } = rankNewsByLocation(news, GUATE)
  assert.equal(items.length, 2)
  assert.equal(protectedIds.size, 0)
})
