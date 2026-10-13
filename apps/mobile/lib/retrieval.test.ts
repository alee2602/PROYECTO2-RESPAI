import { test } from "node:test"
import assert from "node:assert/strict"
import type { News } from "@respai/shared"
import type { UserLocation } from "./locations.ts"
import { RETRIEVAL, normalizeText, parseQuestion, retrieveNews } from "./retrieval.ts"

// Pruebas de la recuperación del chat (Rol 2), con las 4 consultas que pide el
// enunciado (resumir lo reciente, mi región, otro país, un tema) y los casos
// difíciles (algo que no está publicado). Datos: las 12 noticias semilla
// reales (scripts/seed-news/README.md), resumidas.

function makeNews(n: Partial<News> & Pick<News, "id" | "title" | "scope" | "topics">): News {
  return {
    summary: "",
    body: "",
    sources: [{ name: "Fuente", type: "original" }],
    authorId: "test",
    validationStatus: "confirmed",
    createdAt: "2026-10-01T00:00:00.000Z",
    ...n,
  }
}

const SEED: News[] = [
  makeNews({
    id: "caimi", title: "CAIMI de Antigua Guatemala sigue sin avanzar", scope: "local",
    country: "Guatemala", region: "Sacatepéquez", topics: ["salud", "servicios públicos"],
    summary: "El centro de atención materno infantil sigue entrampado.", validationStatus: "unverified",
    publishedAt: "2026-10-02T00:00:00.000Z",
  }),
  makeNews({
    id: "roosevelt", title: "Avanza el paso a desnivel en calzada Roosevelt", scope: "local",
    country: "Guatemala", region: "Ciudad de Guatemala", topics: ["infraestructura"],
    publishedAt: "2026-10-03T00:00:00.000Z",
  }),
  makeNews({
    id: "expoferia", title: "Expoferia del Mueble en Quetzaltenango", scope: "local",
    country: "Guatemala", region: "Quetzaltenango", topics: ["cultura", "comercio"],
    publishedAt: "2026-10-04T00:00:00.000Z",
  }),
  makeNews({
    id: "banguat", title: "Banguat proyecta crecimiento de 4.1% en 2026", scope: "national",
    country: "Guatemala", topics: ["economía"], summary: "Impulsado por las remesas familiares.",
    publishedAt: "2026-10-05T00:00:00.000Z",
  }),
  makeNews({
    id: "combustibles", title: "Arévalo presenta tres propuestas de subsidio a combustibles", scope: "national",
    country: "Guatemala", topics: ["economía", "política"], validationStatus: "in_progress",
    publishedAt: "2026-10-06T00:00:00.000Z",
  }),
  makeNews({
    id: "lluvias", title: "Lluvia deja 13 muertes y Conred mantiene alerta", scope: "national",
    country: "Guatemala", topics: ["clima"], publishedAt: "2026-10-07T00:00:00.000Z",
  }),
  makeNews({
    id: "humania", title: "Vicepresidenta: Guatemala debe prepararse ante la IA", scope: "national",
    country: "Guatemala", topics: ["tecnología", "educación"], summary: "Foro HumanIA sobre inteligencia artificial.",
    publishedAt: "2026-10-08T00:00:00.000Z",
  }),
  makeNews({
    id: "espana", title: "Pedro Sánchez adelanta elecciones en España al 29 de noviembre", scope: "national",
    country: "España", topics: ["política"], publishedAt: "2026-10-09T00:00:00.000Z",
  }),
  makeNews({
    id: "olinia", title: "Sheinbaum presenta Olinia 1, auto eléctrico mexicano", scope: "national",
    country: "México", topics: ["tecnología"], publishedAt: "2026-10-10T00:00:00.000Z",
  }),
  makeNews({
    id: "artemis", title: "Trump condecora a la tripulación de Artemis II", scope: "national",
    country: "Estados Unidos", topics: ["tecnología", "ciencia"], publishedAt: "2026-10-11T00:00:00.000Z",
  }),
  makeNews({
    id: "argentina", title: "Banco Central y Goldman Sachs bajan proyección de crecimiento de Argentina a 2.7%",
    scope: "national", country: "Argentina", topics: ["economía"], validationStatus: "in_progress",
    publishedAt: "2026-09-30T00:00:00.000Z",
  }),
  makeNews({
    id: "cafe", title: "Precio del café cae cerca de 20% en 2026", scope: "international",
    topics: ["economía"], publishedAt: "2026-09-29T00:00:00.000Z",
  }),
]

const XELA: UserLocation = { country: "Guatemala", region: "Quetzaltenango" }
const ANTIGUA: UserLocation = { country: "Guatemala", region: "Sacatepéquez" }
const ids = (r: ReturnType<typeof retrieveNews>) => r.items.map((i) => i.news.id)

// --- Las 4 consultas del enunciado -----------------------------------------

test("resumir lo reciente: devuelve lo más nuevo, como mucho 5", () => {
  const r = retrieveNews("¿Qué pasó hoy? Resúmeme lo último", SEED, XELA)
  assert.deepEqual(ids(r), ["artemis", "olinia", "espana", "humania", "lluvias"])
  assert.deepEqual(r.unmatchedTerms, [])
})

test("mi región: trae primero lo de la región simulada", () => {
  const r = retrieveNews("¿Qué noticias hay en mi región?", SEED, ANTIGUA)
  assert.equal(ids(r)[0], "caimi")
  assert.ok(r.items[0].why.some((w) => w.includes("tu región")))
})

test("mi región: con otra ubicación, cambia la respuesta", () => {
  assert.equal(ids(retrieveNews("¿Qué pasó en mi zona?", SEED, XELA))[0], "expoferia")
})

test("otro país: explica la noticia de España", () => {
  const r = retrieveNews("Explícame la noticia de las elecciones en España", SEED, XELA)
  assert.equal(ids(r)[0], "espana")
})

test("un tema: economía trae solo noticias de economía (sin importar tildes)", () => {
  const r = retrieveNews("¿Qué novedades hay de economia?", SEED, XELA)
  assert.ok(r.items.length > 0)
  for (const i of r.items) assert.ok(i.news.topics.includes("economía"), `${i.news.id} no es de economía`)
})

// --- Detalles de búsqueda ---------------------------------------------------

test("alias de lugar: 'Xela' es Quetzaltenango", () => {
  assert.equal(ids(retrieveNews("¿Qué hay en Xela?", SEED, ANTIGUA))[0], "expoferia")
})

test("raíz de la palabra: 'lluvias' encuentra 'Lluvia'", () => {
  assert.equal(ids(retrieveNews("¿Cuántas muertes por las lluvias?", SEED, XELA))[0], "lluvias")
})

test("siglas cortas útiles: 'IA' se busca", () => {
  assert.equal(ids(retrieveNews("¿Qué dijo la vicepresidenta sobre la IA?", SEED, XELA))[0], "humania")
})

test("no filtra por validación: una noticia no verificada también se recupera", () => {
  const r = retrieveNews("¿Qué pasa con el CAIMI de Antigua?", SEED, XELA)
  assert.equal(ids(r)[0], "caimi")
  assert.equal(r.items[0].news.validationStatus, "unverified")
})

test("nunca devuelve más de maxResults noticias", () => {
  const r = retrieveNews("Noticias de Guatemala", SEED, XELA)
  assert.ok(r.items.length <= RETRIEVAL.maxResults)
})

// --- Casos difíciles: lo que NO está publicado ------------------------------

test("algo no publicado: no devuelve noticias y dice qué palabras no encontró", () => {
  const r = retrieveNews("¿Qué pasó con el terremoto en Japón?", SEED, XELA)
  assert.deepEqual(ids(r), [], "no debe rellenar con noticias al azar")
  assert.deepEqual(r.unmatchedTerms.sort(), ["japon", "terremoto"])
})

test("algo no publicado en un país que sí existe: trae ese país pero avisa lo que falta", () => {
  // Hay noticias de España, pero ninguna de un terremoto: el chat tendrá que
  // decir que no hay nada sobre el terremoto (unmatchedTerms), no afirmarlo.
  const r = retrieveNews("¿Hubo un terremoto en España?", SEED, XELA)
  assert.equal(ids(r)[0], "espana")
  assert.deepEqual(r.unmatchedTerms, ["terremoto"])
})

test("pregunta vacía o solo muletillas: no devuelve nada", () => {
  assert.equal(retrieveNews("", SEED, XELA).items.length, 0)
  assert.equal(retrieveNews("hola, gracias", SEED, XELA).items.length, 0)
})

test("sin noticias publicadas: no revienta", () => {
  assert.equal(retrieveNews("¿Qué pasó hoy?", [], XELA).items.length, 0)
})

// --- Utilidades -------------------------------------------------------------

test("normalizeText quita tildes, mayúsculas y signos", () => {
  assert.equal(normalizeText("¿Qué pasó en EE.UU.?"), "que paso en ee uu")
})

test("parseQuestion detecta lugar, 'mi país' y lo reciente", () => {
  const q = parseQuestion("¿Qué es lo último a nivel nacional en mi país y en EE.UU.?")
  assert.equal(q.recent, true)
  assert.equal(q.myCountry, true)
  assert.deepEqual(q.places, [{ country: "Estados Unidos" }])
})
