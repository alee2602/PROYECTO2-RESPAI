import type { News } from "@respai/shared"
import type { UserLocation } from "@/lib/locations"
// Ruta relativa con extensión (no "@/lib/..."): este import sí existe en
// ejecución y tiene que resolverse también en `node --test`.
import { newsAffinity, type TopicAffinity } from "./affinity.ts"

// Deliberadamente sin importar lib/news.ts (que inicializa el cliente de
// Firebase): este módulo es puro (sin red, sin Firebase) para poder probarlo
// con `node --test` sin arrastrar nada más. Mismo criterio que `newsDate` en
// lib/news.ts.
function newsDate(n: News): string {
  return n.publishedAt ?? n.createdAt
}

// ---------------------------------------------------------------------------
// Ranking de Rol 4: puntaje por reglas (cercanía + validación + recencia +
// afinidad por tema), con protección anti-burbuja (CLAUDE.md sección 3). Sin
// modelo, sin esconder ninguna noticia — solo ordena y, cuando hace falta,
// promueve alcances que faltarían arriba.
//
// Deliberadamente sin dependencias de lib/feed.ts (que sí importa de aquí)
// para evitar un import circular: este archivo solo conoce `News` y
// `UserLocation`, nunca `FeedItem`/`RankFn`.
//
// La afinidad por tema sale de `users/{uid}/signals` (lib/affinity.ts) y es un
// componente más del puntaje. El piso anti-burbuja se aplica DESPUÉS del
// puntaje, así que la afinidad nunca lo desplaza.
// ---------------------------------------------------------------------------

// Cuántas posiciones arriba del feed cuentan como "el tope" para la
// protección anti-burbuja (hero + large + el inicio de normal).
const TOP_WINDOW = 6

// ---------------------------------------------------------------------------
// Puntaje numérico (mayor = más relevante). Tabla de pesos y motivo de cada
// cambio en docs/ranking.md — si cambias un número aquí, anótalo allá.
//
// Sin afinidad (usuario sin señales), el orden es exactamente cercanía, luego
// validación, luego fecha: cada escalón de un criterio vale más que el máximo
// de todos los que vienen después. Lo comprueba una prueba en ranking.test.ts.
//
// La afinidad rompe eso A PROPÓSITO, pero acotada: su máximo (< 15) puede
// subir una noticia un escalón de cercanía (10), nunca dos (20). También lo
// comprueba una prueba.
// ---------------------------------------------------------------------------
export const WEIGHTS = {
  location: {
    localSameRegion: 40, // local de tu región
    sameCountry: 30, // nacional de tu país, o internacional que ocurre en tu país
    localSameCountry: 20, // local de otra región de tu país
    international: 10, // internacional de otro país (o sin país)
    otherCountry: 0, // local o nacional de otro país
  },
  // Entre noticias igual de cercanas, la más confirmada va primero. NO es un
  // filtro — una `unverified` sigue apareciendo siempre que exista, solo deja
  // de ganarle a algo igual de relevante y mejor sustentado por pura
  // coincidencia de ubicación. (Encontrado probando con datos reales: una
  // noticia de fuente única sin confirmar terminó de "hero" por ser la única
  // coincidencia de país para esa ubicación — ver docs/ciclos.md, 2026-10-10.)
  validation: { confirmed: 4, in_progress: 2, unverified: 0 },
  // Recencia entre 0 y `max`, relativa a la noticia más nueva del pool (no a
  // la hora actual, para que el ranking sea una función pura y repetible):
  // la más nueva vale `max`, una `halfLifeHours` más vieja vale la mitad.
  recency: { max: 1, halfLifeHours: 48 },
  // Afinidad por tema: `max` × interés (entre 0 y 1, nunca llega a 1; ver
  // lib/affinity.ts). Puede saltar un escalón de cercanía, nunca dos.
  // `explainFrom`: desde cuántos puntos la tarjeta dice "Sigues el tema...".
  affinity: { max: 15, explainFrom: 3 },
} as const

export type ScoreBreakdown = {
  location: number
  validation: number
  recency: number
  affinity: number
  affinityTopic: string | null // tema que aportó la afinidad (para explicarlo)
  total: number
}

function locationPoints(n: News, loc: UserLocation): number {
  const w = WEIGHTS.location
  const sameCountry = n.country === loc.country
  const sameRegion = Boolean(loc.region) && n.region === loc.region
  if (n.scope === "local" && sameRegion) return w.localSameRegion
  if (n.scope === "national" && sameCountry) return w.sameCountry
  if (n.scope === "international" && sameCountry) return w.sameCountry
  if (n.scope === "local" && sameCountry) return w.localSameCountry
  if (n.scope === "international") return w.international
  return w.otherCountry
}

function recencyPoints(n: News, referenceMs: number): number {
  const t = Date.parse(newsDate(n))
  if (Number.isNaN(t)) return 0 // fecha ilegible: sin bono de recencia, pero no se oculta
  const ageHours = Math.max(0, (referenceMs - t) / 3_600_000)
  const { max, halfLifeHours } = WEIGHTS.recency
  return (max * halfLifeHours) / (halfLifeHours + ageHours)
}

// Desglose del puntaje de una noticia para una ubicación. `referenceMs` es la
// fecha de la noticia más nueva del pool (ver WEIGHTS.recency). Sin
// `affinity` (o vacía), la afinidad vale 0.
export function scoreNews(
  n: News,
  loc: UserLocation,
  referenceMs: number,
  affinity: TopicAffinity = new Map()
): ScoreBreakdown {
  const location = locationPoints(n, loc)
  const validation = WEIGHTS.validation[n.validationStatus] ?? 0
  const recency = recencyPoints(n, referenceMs)
  const interest = newsAffinity(n.topics, affinity)
  const affinityPoints = WEIGHTS.affinity.max * Math.min(Math.max(interest.value, 0), 0.999)
  return {
    location,
    validation,
    recency,
    affinity: affinityPoints,
    affinityTopic: interest.topic,
    total: location + validation + recency + affinityPoints,
  }
}

function newestDateMs(news: News[]): number {
  const times = news.map((n) => Date.parse(newsDate(n))).filter((t) => !Number.isNaN(t))
  return times.length > 0 ? Math.max(...times) : 0
}

// Promueve al menos una noticia de cada alcance (si existe en todo el pool)
// dentro de las primeras TOP_WINDOW posiciones. No saca ninguna noticia del
// feed, solo reordena: la que cede su lugar baja, no desaparece.
//
// Importante: los alcances que faltan se calculan UNA SOLA VEZ, contra la
// ventana original, y las promociones se insertan todas juntas. Insertarlas
// una por una en la misma posición fija empujaba a la primera fuera de la
// ventana en cuanto se insertaba la segunda — bug real, encontrado con las
// pruebas de este mismo archivo.
function applyDiversityFloor(sorted: News[]): { items: News[]; protectedIds: Set<string> } {
  const scopes: News["scope"][] = ["local", "national", "international"]
  const existingScopes = new Set(sorted.map((n) => n.scope))
  const windowScopes = new Set(sorted.slice(0, TOP_WINDOW).map((n) => n.scope))
  const missing = scopes.filter((s) => existingScopes.has(s) && !windowScopes.has(s))

  if (missing.length === 0) return { items: sorted, protectedIds: new Set() }

  const items = [...sorted]
  const protectedIds = new Set<string>()
  const candidates: News[] = []

  for (const scope of missing) {
    // La mejor candidata de este alcance fuera de la ventana (ya viene
    // ordenada por score, así que la primera que aparezca es la mejor).
    const candidateIndex = items.findIndex((n, i) => i >= TOP_WINDOW && n.scope === scope)
    if (candidateIndex === -1) continue
    const [candidate] = items.splice(candidateIndex, 1)
    candidates.push(candidate)
    protectedIds.add(candidate.id)
  }

  // Todas las promociones entran juntas, al final de la ventana protegida.
  const insertAt = Math.max(0, TOP_WINDOW - candidates.length)
  items.splice(insertAt, 0, ...candidates)

  return { items, protectedIds }
}

export type RankedNews = {
  items: News[]
  protectedIds: Set<string>
  // newsId → tema por el que la afinidad la subió de forma notable
  // (≥ WEIGHTS.affinity.explainFrom puntos), para decirlo en la tarjeta.
  affinityTopics: Map<string, string>
}

// Ordena por puntaje (cercanía + validación + recencia + afinidad) y aplica el
// piso anti-burbuja. No conoce FeedItem/prominencia: eso lo arma lib/feed.ts a
// partir de este resultado. Sin `affinity`, ordena igual que antes de existir.
export function rankNewsByLocation(
  news: News[],
  location: UserLocation,
  affinity: TopicAffinity = new Map()
): RankedNews {
  const referenceMs = newestDateMs(news)
  const scores = new Map(news.map((n) => [n, scoreNews(n, location, referenceMs, affinity)]))
  const sorted = [...news].sort((a, b) => scores.get(b)!.total - scores.get(a)!.total)

  const affinityTopics = new Map<string, string>()
  for (const [n, s] of scores) {
    if (s.affinityTopic && s.affinity >= WEIGHTS.affinity.explainFrom) affinityTopics.set(n.id, s.affinityTopic)
  }

  return { ...applyDiversityFloor(sorted), affinityTopics }
}

// `news.scope` describe el alcance PROPIO de la noticia (para qué tan lejos
// llega su relevancia — lo usa el ranking de arriba). La etiqueta que se
// MUESTRA en pantalla es distinta: es relativa a dónde estás simulando
// estar, porque puedes cambiar de ubicación en cualquier momento. Ejemplo:
// una noticia nacional de España se ve "Nacional" si simulas estar en
// España, pero "Internacional" si simulas estar en Guatemala o EE.UU. — la
// MISMA noticia, etiqueta distinta según quién la ve (decisión del
// 2026-10-10, ver docs/ciclos.md).
export function displayScope(n: News, loc: UserLocation): News["scope"] {
  if (!n.country || n.country !== loc.country) return "international"
  if (n.scope === "local" && Boolean(loc.region) && n.region === loc.region) return "local"
  return "national"
}
