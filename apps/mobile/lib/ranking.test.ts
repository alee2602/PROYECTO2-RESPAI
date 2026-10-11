import { test } from "node:test"
import assert from "node:assert/strict"
import type { News } from "@respai/shared"
import type { UserLocation } from "./locations.ts"
import { WEIGHTS, displayScope, rankNewsByLocation, scoreNews } from "./ranking.ts"
import type { TopicAffinity } from "./affinity.ts"

// Pruebas del criterio de aceptación de Rol 4 (docs/roles-equipo.md):
// "Para cada ubicación simulada, el top del feed incluye local, nacional e
// internacional cuando existen" y "un usuario muy aficionado a un tema sigue
// viendo noticias importantes de otros alcances" (probado vía ubicación y,
// al final del archivo, vía afinidad por tema).

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

// ---------------------------------------------------------------------------
// Paso a puntaje numérico (rama rol4/ranking-puntaje): el orden NO debe
// cambiar respecto al comparador anterior (cercanía → validación → fecha).
// ---------------------------------------------------------------------------

// Copia literal del comparador anterior, como referencia de "comportamiento
// de antes". Menor = más relevante.
function oldCompare(a: News, b: News, loc: UserLocation): number {
  const proximity = (n: News) => {
    const sameCountry = n.country === loc.country
    const sameRegion = Boolean(loc.region) && n.region === loc.region
    if (n.scope === "local" && sameRegion) return 0
    if (n.scope === "national" && sameCountry) return 1
    if (n.scope === "international" && sameCountry) return 1
    if (n.scope === "local" && sameCountry) return 2
    if (n.scope === "international") return 3
    return 4
  }
  const validation = (n: News) =>
    n.validationStatus === "confirmed" ? 0 : n.validationStatus === "in_progress" ? 1 : 2
  return (
    proximity(a) - proximity(b) ||
    validation(a) - validation(b) ||
    (b.publishedAt ?? b.createdAt).localeCompare(a.publishedAt ?? a.createdAt)
  )
}

test("el puntaje numérico ordena exactamente igual que el comparador anterior", () => {
  // Generador pseudoaleatorio con semilla fija: la prueba es repetible.
  let seed = 42
  const rand = () => ((seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648) / 2_147_483_648)
  const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)]

  const places = [
    { country: "Guatemala", region: "Quetzaltenango" },
    { country: "Guatemala", region: "Sacatepéquez" },
    { country: "México", region: "Jalisco" },
    { country: "España", region: undefined },
    { country: undefined, region: undefined },
  ]
  const locations: UserLocation[] = [GUATE, { country: "Guatemala", region: null }, { country: "España", region: null }]
  const start = Date.parse("2026-01-01T00:00:00.000Z")

  for (let round = 0; round < 300; round++) {
    const loc = pick(locations)
    const pool = Array.from({ length: 2 + Math.floor(rand() * 12) }, () => {
      const place = pick(places)
      return makeNews({
        scope: pick(["local", "national", "international"] as const),
        country: place.country,
        region: place.region,
        validationStatus: pick(["confirmed", "in_progress", "unverified"] as const),
        // Pocas fechas posibles a propósito, para forzar empates de fecha.
        createdAt: new Date(start + Math.floor(rand() * 20) * 7 * 3_600_000).toISOString(),
      })
    })

    const expected = [...pool].sort((a, b) => oldCompare(a, b, loc)).map((n) => n.id)
    const ref = Math.max(...pool.map((n) => Date.parse(n.createdAt)))
    const actual = [...pool]
      .sort((a, b) => scoreNews(b, loc, ref).total - scoreNews(a, loc, ref).total)
      .map((n) => n.id)
    assert.deepEqual(actual, expected, `orden distinto en la ronda ${round}`)
  }
})

test("pesos: cada escalón de un criterio vale más que todo lo que viene después", () => {
  // Si alguien cambia WEIGHTS y rompe esto, el orden deja de ser
  // cercanía → validación → fecha. Puede ser intencional (p. ej. al sumar
  // afinidad), pero entonces se cambia esta prueba y se anota en docs/ranking.md.
  const loc = Object.values(WEIGHTS.location).sort((a, b) => b - a)
  const val = Object.values(WEIGHTS.validation).sort((a, b) => b - a)
  const maxVal = val[0]
  const maxRec = WEIGHTS.recency.max

  for (let i = 0; i < loc.length - 1; i++) {
    assert.ok(loc[i] - loc[i + 1] > maxVal + maxRec, `escalón de cercanía ${loc[i]}→${loc[i + 1]} muy chico`)
  }
  for (let i = 0; i < val.length - 1; i++) {
    assert.ok(val[i] - val[i + 1] > maxRec, `escalón de validación ${val[i]}→${val[i + 1]} muy chico`)
  }
})

test("scoreNews: desglose de una noticia local confirmada de tu región, la más nueva del pool", () => {
  const n = makeNews({
    scope: "local",
    country: "Guatemala",
    region: "Quetzaltenango",
    validationStatus: "confirmed",
    createdAt: "2026-03-03T00:00:00.000Z",
  })
  const ref = Date.parse("2026-03-03T00:00:00.000Z")
  assert.deepEqual(scoreNews(n, GUATE, ref), {
    location: 40,
    validation: 4,
    recency: 1,
    affinity: 0, // sin señales
    affinityTopic: null,
    total: 45,
  })

  // La misma noticia, una vida media (48 h) más vieja que la más nueva del pool.
  const s = scoreNews(n, GUATE, ref + 48 * 3_600_000)
  assert.equal(s.recency, 0.5)
})

// ---------------------------------------------------------------------------
// Afinidad por tema (rama rol4/afinidad).
// ---------------------------------------------------------------------------

// Fan extremo de deportes: el interés más alto posible.
const FAN_DEPORTES: TopicAffinity = new Map([["deportes", 0.99]])

test("criterio de aceptación: un fan extremo de un tema sigue viendo local, nacional e internacional arriba", () => {
  const news = [
    // Ocho noticias de deportes de su país: con la afinidad, todas le ganan
    // por puntaje a la local de su región y llenarían solas el top.
    ...Array.from({ length: 8 }, (_, i) =>
      makeNews({ id: `deportes-${i}`, scope: "national", country: "Guatemala", topics: ["deportes"] })
    ),
    makeNews({ id: "local-salud", scope: "local", country: "Guatemala", region: "Quetzaltenango", topics: ["salud"] }),
    makeNews({ id: "intl-clima", scope: "international", country: "Argentina", topics: ["clima"] }),
  ]

  const { items, protectedIds } = rankNewsByLocation(news, GUATE, FAN_DEPORTES)
  const top6 = items.slice(0, 6)

  assert.ok(top6.some((n) => n.id === "local-salud"), "la local de su región no puede desaparecer del top")
  assert.ok(top6.some((n) => n.id === "intl-clima"), "la internacional no puede desaparecer del top")
  assert.ok(protectedIds.has("local-salud") && protectedIds.has("intl-clima"), "entraron por el piso anti-burbuja")
  assert.equal(items.length, news.length, "no se esconde ninguna noticia")
})

test("afinidad: un tema que lees mucho sube un escalón de cercanía y la tarjeta lo explica", () => {
  const news = [
    makeNews({ id: "local-otra-region", scope: "local", country: "Guatemala", region: "Petén", topics: ["salud"] }),
    makeNews({ id: "intl-deportes", scope: "international", country: "Argentina", topics: ["deportes"] }),
  ]

  const sinAfinidad = rankNewsByLocation(news, GUATE)
  assert.deepEqual(sinAfinidad.items.map((n) => n.id), ["local-otra-region", "intl-deportes"])
  assert.equal(sinAfinidad.affinityTopics.size, 0)

  const conAfinidad = rankNewsByLocation(news, GUATE, FAN_DEPORTES)
  assert.deepEqual(conAfinidad.items.map((n) => n.id), ["intl-deportes", "local-otra-region"])
  assert.equal(conAfinidad.affinityTopics.get("intl-deportes"), "deportes")
})

test("afinidad: nunca sube dos escalones de cercanía, ni en el peor caso", () => {
  // Lo más favorecido posible de otro país (confirmada, la más nueva, afinidad
  // máxima) contra lo menos favorecido de tu país (local de otra región, no
  // verificada, la más vieja): gana tu país.
  const news = [
    makeNews({
      id: "otro-pais-fan",
      scope: "national",
      country: "México",
      topics: ["deportes"],
      validationStatus: "confirmed",
      createdAt: "2026-09-01T00:00:00.000Z",
    }),
    makeNews({
      id: "tu-pais",
      scope: "local",
      country: "Guatemala",
      region: "Petén",
      topics: ["salud"],
      validationStatus: "unverified",
      createdAt: "2020-01-01T00:00:00.000Z",
    }),
  ]
  const { items } = rankNewsByLocation(news, GUATE, new Map([["deportes", 1]])) // incluso con interés = 1
  assert.deepEqual(items.map((n) => n.id), ["tu-pais", "otro-pais-fan"])
})

test("afinidad débil (una lectura suelta) no se anuncia en la tarjeta", () => {
  const n = makeNews({ id: "x", scope: "international", country: "Argentina", topics: ["deportes"] })
  const debil: TopicAffinity = new Map([["deportes", 0.1]]) // 1,5 puntos, menos que explainFrom
  assert.equal(rankNewsByLocation([n], GUATE, debil).affinityTopics.size, 0)
})

test("pesos: la afinidad máxima alcanza para un escalón de cercanía, nunca para dos", () => {
  const loc = Object.values(WEIGHTS.location).sort((a, b) => b - a)
  const minStep = Math.min(...loc.slice(0, -1).map((v, i) => v - loc[i + 1]))
  const maxVal = Math.max(...Object.values(WEIGHTS.validation))
  assert.ok(WEIGHTS.affinity.max > minStep, "si no alcanza un escalón, la afinidad casi no se notaría")
  assert.ok(
    WEIGHTS.affinity.max + maxVal + WEIGHTS.recency.max <= 2 * minStep,
    "la afinidad no debe poder saltar dos escalones de cercanía"
  )
})
