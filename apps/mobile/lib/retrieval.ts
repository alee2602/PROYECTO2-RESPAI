import type { News } from "@respai/shared"
// Rutas relativas con extensión: estos imports existen en ejecución y tienen
// que resolverse también en `node --test` (mismo criterio que lib/ranking.ts).
import { LOCATIONS, type UserLocation } from "./locations.ts"

// ---------------------------------------------------------------------------
// Recuperación de noticias para el chat (Rol 2). SIN MODELO.
//
// Dada una pregunta, la ubicación simulada y las noticias PUBLICADAS, elige
// las pocas noticias relevantes que se le pasarán al modelo como contexto.
// Es la regla de oro de CLAUDE.md (sección 4): recuperar se resuelve con
// reglas, el modelo solo redacta la respuesta final con lo ya recuperado.
//
// Módulo puro (sin Firebase, sin red) para probarlo con `node --test` y
// usarlo igual en el servidor (endpoint del chat).
//
// Qué NO hace, a propósito:
// - No filtra por estado de validación: una noticia `unverified` también se
//   recupera; el chat debe decir que no está confirmada, no esconderla.
// - No decide si algo es verdad: solo elige qué noticias publicadas son
//   pertinentes a la pregunta.
// - No recibe borradores: quien la llama debe pasar solo noticias publicadas
//   (fetchPublishedNews ya las filtra).
// ---------------------------------------------------------------------------

export const RETRIEVAL = {
  maxResults: 5, // contexto corto: pocas noticias por pregunta
  stemLength: 5, // las palabras se comparan por su raíz de 5 letras
  weights: {
    title: 3, // la palabra aparece en el título
    topic: 3, // ...o en los temas
    summary: 1, // ...o solo en el resumen
    body: 0.5, // ...o solo en el cuerpo
    place: 5, // la noticia es del país mencionado / de tu país si dices "mi país"
    region: 6, // la noticia es de la región mencionada / de tu región si dices "mi región"
    recency: 1, // bono de recencia, entre 0 y esto
  },
  recencyHalfLifeHours: 72,
} as const

// Palabras que no aportan para buscar: artículos, preguntas típicas y
// muletillas del chat ("dime", "resúmeme", "noticias"...). Sin tildes.
const STOPWORDS = new Set(
  `a al algo algun alguna algunas alguno algunos ante antes aqui asi aun bien cada como con contra cual cuales
  cuando cuanto de del desde donde dos e el ella ellas ellos en entre era es esa esas ese eso esos esta estan
  estas este esto estos fue fueron ha han hasta hay la las le les lo los mas me mi mis mucho muy no nos o otra
  otras otro otros para pero poco por porque pues que quien quienes se sea segun ser si sido sin sobre son su
  sus tambien tan te tiene tienen toda todas todo todos tu tus un una unas uno unos y ya yo
  dime decime cuentame cuenta contame explica explicame explicar resume resumeme resumir resumen resumenes
  puedes podrias quiero quisiera saber sabe sabes paso pasa pasado pasando ocurrio ocurre sucedio sucede
  hubo hace hizo dice dijo dicen va van sera seria puede pueden tienes estado vez veces
  hablame habla informacion info noticia noticias nota notas novedad novedades dato datos tema temas
  hoy reciente recientes ultima ultimas ultimo ultimos ahora actual actuales nuevo nueva nuevos nuevas
  importante importantes principal principales relevante relevantes interesante
  region zona area pais ciudad local locales nacional nacionales internacional internacionales mundo
  aqui alla cerca favor gracias hola buenas buenos dias tardes noches`.split(/\s+/).filter(Boolean)
)

const SHORT_TERMS = new Set(["ia"])

// Palabras que piden "lo más reciente" cuando no hay un tema concreto.
const RECENT_WORDS = new Set([
  "hoy", "reciente", "recientes", "ultima", "ultimas", "ultimo", "ultimos", "ahora",
  "resume", "resumeme", "resumir", "resumen", "novedad", "novedades", "paso", "pasado",
])

// Alias de lugares, ya normalizados (sin tildes, minúsculas).
const PLACE_ALIASES: Record<string, { country: string; region?: string }> = {
  xela: { country: "Guatemala", region: "Quetzaltenango" },
  antigua: { country: "Guatemala", region: "Sacatepéquez" },
  "ciudad de guatemala": { country: "Guatemala", region: "Ciudad de Guatemala" },
  guate: { country: "Guatemala" },
  "ee uu": { country: "Estados Unidos" },
  eeuu: { country: "Estados Unidos" },
  usa: { country: "Estados Unidos" },
  "estados unidos": { country: "Estados Unidos" },
  cdmx: { country: "México", region: "Ciudad de México" },
  mexico: { country: "México" },
}

export function normalizeText(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9ñ\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function stem(word: string): string {
  return word.slice(0, RETRIEVAL.stemLength)
}

function words(s: string): string[] {
  return normalizeText(s).split(" ").filter(Boolean)
}

type Place = { country: string; region?: string }

// Lugares que aparecen en la pregunta (por nombre de país/región o alias).
function findPlaces(normQuestion: string): Place[] {
  const padded = ` ${normQuestion} `
  const has = (name: string) => padded.includes(` ${normalizeText(name)} `)
  const places: Place[] = []
  for (const c of LOCATIONS) {
    for (const r of c.regions) if (has(r.name)) places.push({ country: c.country, region: r.name })
    if (has(c.country)) places.push({ country: c.country })
  }
  for (const [alias, place] of Object.entries(PLACE_ALIASES)) if (has(alias)) places.push(place)
  // Sin repetidos ("Estados Unidos" se detecta por nombre y por alias).
  const seen = new Set<string>()
  return places.filter((p) => {
    const key = `${p.country}|${p.region ?? ""}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

// Palabras de la pregunta que nombran un lugar (no se buscan como tema).
function placeWords(): Set<string> {
  const set = new Set<string>()
  for (const c of LOCATIONS) {
    for (const w of words(c.country)) set.add(w)
    for (const r of c.regions) for (const w of words(r.name)) set.add(w)
  }
  for (const alias of Object.keys(PLACE_ALIASES)) for (const w of alias.split(" ")) set.add(w)
  return set
}
const PLACE_WORDS = placeWords()

export type QueryIntent = {
  terms: string[] // palabras con contenido (normalizadas), para buscar
  places: Place[] // lugares nombrados
  myRegion: boolean // "mi región", "mi zona", "aquí", "cerca"
  myCountry: boolean // "mi país", "nacional"
  recent: boolean // "hoy", "lo último", "resúmeme"...
}

export function parseQuestion(question: string): QueryIntent {
  const norm = normalizeText(question)
  const ws = norm.split(" ").filter(Boolean)
  const padded = ` ${norm} `
  // Palabras de 1-2 letras no se buscan, salvo siglas útiles como "IA".
  const terms = [
    ...new Set(ws.filter((w) => (w.length > 2 || SHORT_TERMS.has(w)) && !STOPWORDS.has(w) && !PLACE_WORDS.has(w))),
  ]
  return {
    terms,
    places: findPlaces(norm),
    myRegion: /\b(mi|mis) (region|zona|area|ciudad|departamento|estado|provincia)\b/.test(norm) || / (aqui|cerca) /.test(padded),
    myCountry: /\b(mi|mis) pais\b/.test(norm) || / nacional(es)? /.test(padded),
    recent: ws.some((w) => RECENT_WORDS.has(w)),
  }
}

export type RetrievedNews = {
  news: News
  score: number
  why: string[] // por qué se eligió (transparencia y evidencia de pruebas)
}

export type RetrievalResult = {
  items: RetrievedNews[]
  intent: QueryIntent
  // Palabras de la pregunta que no aparecen en NINGUNA noticia publicada.
  // Sirven para que el chat diga "no encontré nada sobre X" en vez de inventar.
  unmatchedTerms: string[]
}

function newsDate(n: News): string {
  return n.publishedAt ?? n.createdAt
}

export function retrieveNews(question: string, news: News[], location: UserLocation): RetrievalResult {
  const intent = parseQuestion(question)
  const w = RETRIEVAL.weights
  const termStems = intent.terms.map(stem)

  // Índice de raíces por noticia y por campo.
  const indexed = news.map((n) => ({
    n,
    title: new Set(words(n.title).map(stem)),
    topics: new Set(n.topics.flatMap(words).map(stem)),
    summary: new Set(words(n.summary).map(stem)),
    body: new Set(words(n.body).map(stem)),
  }))

  const times = news.map((n) => Date.parse(newsDate(n))).filter((t) => !Number.isNaN(t))
  const newest = times.length ? Math.max(...times) : 0
  const recencyBonus = (n: News) => {
    const t = Date.parse(newsDate(n))
    if (Number.isNaN(t)) return 0
    const ageHours = Math.max(0, (newest - t) / 3_600_000)
    return (w.recency * RETRIEVAL.recencyHalfLifeHours) / (RETRIEVAL.recencyHalfLifeHours + ageHours)
  }

  const matchedTerms = new Set<string>()
  const scored: RetrievedNews[] = []

  for (const { n, title, topics, summary, body } of indexed) {
    let relevance = 0 // solo tema y lugar; la recencia sola no hace relevante una noticia
    const why: string[] = []

    intent.terms.forEach((term, i) => {
      const s = termStems[i]
      let points = 0
      if (title.has(s)) points = w.title
      else if (topics.has(s)) points = w.topic
      else if (summary.has(s)) points = w.summary
      else if (body.has(s)) points = w.body
      if (points > 0) {
        relevance += points
        matchedTerms.add(term)
        why.push(`menciona "${term}"`)
      }
    })

    for (const p of intent.places) {
      if (p.region && n.region === p.region) {
        relevance += w.region
        why.push(`es de ${p.region}`)
      } else if (!p.region && n.country === p.country) {
        relevance += w.place
        why.push(`es de ${p.country}`)
      }
    }

    if (intent.myRegion && location.region && n.region === location.region) {
      relevance += w.region
      why.push(`ocurre en tu región (${location.region})`)
    } else if ((intent.myRegion || intent.myCountry) && n.country === location.country) {
      relevance += w.place
      why.push(`ocurre en tu país (${location.country})`)
    }

    scored.push({ news: n, score: relevance, why })
  }

  const unmatchedTerms = intent.terms.filter((t) => !matchedTerms.has(t))
  const byScore = (a: RetrievedNews, b: RetrievedNews) =>
    b.score - a.score || newsDate(b.news).localeCompare(newsDate(a.news))

  const relevant = scored.filter((r) => r.score > 0)
  let items: RetrievedNews[]

  if (relevant.length > 0) {
    // Hay noticias que coinciden por tema o lugar: solo esas, con un pequeño
    // bono de recencia para desempatar entre parecidas.
    items = relevant.map((r) => ({ ...r, score: r.score + recencyBonus(r.news) }))
  } else if (intent.recent && unmatchedTerms.length === 0) {
    // Pregunta general ("¿qué pasó hoy?", "resúmeme lo último"): lo más
    // reciente. Si la pregunta pedía algo concreto que no existe (quedaron
    // palabras sin encontrar), NO se rellena con noticias al azar.
    items = scored.map((r) => ({ ...r, score: recencyBonus(r.news), why: ["de lo más reciente publicado"] }))
  } else {
    items = []
  }

  return { items: items.sort(byScore).slice(0, RETRIEVAL.maxResults), intent, unmatchedTerms }
}
