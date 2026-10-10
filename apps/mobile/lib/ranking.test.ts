import { test } from "node:test"
import assert from "node:assert/strict"
import type { News } from "@respai/shared"
import type { UserLocation } from "./locations.ts"
import { displayScope, rankNewsByLocation } from "./ranking.ts"

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

test("entre noticias igual de cercanas, la más confirmada va primero (pero no se esconde la menos confirmada)", () => {
  // Caso real encontrado probando con datos reales (ubicación California, EE.UU.):
  // una "unverified" de fuente única era la ÚNICA noticia de ese país, y por
  // eso terminaba de hero sin competencia por cercanía. El desempate por
  // validación evita que gane por casualidad cuando sí hay competencia.
  const news = [
    makeNews({
      id: "rumor",
      scope: "international",
      country: "Estados Unidos",
      validationStatus: "unverified",
      createdAt: "2026-06-01T00:00:00.000Z", // más reciente, pero menos confirmada
    }),
    makeNews({
      id: "oficial",
      scope: "international",
      country: "Estados Unidos",
      validationStatus: "confirmed",
      createdAt: "2026-01-01T00:00:00.000Z", // más vieja, pero confirmada
    }),
  ]
  const loc: UserLocation = { country: "Estados Unidos", region: null }
  const { items } = rankNewsByLocation(news, loc)

  assert.equal(items[0]?.id, "oficial", "la confirmada debería ganar el primer lugar")
  assert.equal(items.length, 2, "la no verificada no debe desaparecer")
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

test("displayScope: la MISMA noticia se etiqueta distinto según quién la ve", () => {
  const espana = makeNews({ id: "espana", scope: "national", country: "España" })

  assert.equal(
    displayScope(espana, { country: "España", region: null }),
    "national",
    "para alguien en España, es nacional"
  )
  assert.equal(
    displayScope(espana, { country: "Guatemala", region: "Quetzaltenango" }),
    "international",
    "para alguien en Guatemala, es internacional"
  )
  assert.equal(
    displayScope(espana, { country: "Estados Unidos", region: "California" }),
    "international",
    "para alguien en EE.UU., también es internacional"
  )
})

test("displayScope: local solo si coincide país Y región; si no, cae a nacional", () => {
  const antigua = makeNews({ id: "antigua", scope: "local", country: "Guatemala", region: "Sacatepéquez" })

  assert.equal(
    displayScope(antigua, { country: "Guatemala", region: "Sacatepéquez" }),
    "local",
    "misma región: local"
  )
  assert.equal(
    displayScope(antigua, { country: "Guatemala", region: "Quetzaltenango" }),
    "national",
    "mismo país, otra región: nacional (sigue siendo de tu país)"
  )
  assert.equal(
    displayScope(antigua, { country: "México", region: null }),
    "international",
    "otro país: internacional"
  )
})

test("displayScope: sin país (ej. precio internacional del café) siempre es internacional", () => {
  const cafe = makeNews({ id: "cafe", scope: "international" })
  assert.equal(displayScope(cafe, { country: "Guatemala", region: "Quetzaltenango" }), "international")
})
