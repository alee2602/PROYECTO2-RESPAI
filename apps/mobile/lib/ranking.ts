import type { News } from "@respai/shared"
import type { UserLocation } from "@/lib/locations"

// Deliberadamente sin importar lib/news.ts (que inicializa el cliente de
// Firebase): este módulo es puro (sin red, sin Firebase) para poder probarlo
// con `node --test` sin arrastrar nada más. Mismo criterio que `newsDate` en
// lib/news.ts.
function newsDate(n: News): string {
  return n.publishedAt ?? n.createdAt
}

// ---------------------------------------------------------------------------
// Ranking de Rol 4, Etapa 1: ubicación + recencia, con protección anti-burbuja
// (CLAUDE.md sección 3). Sin modelo, sin esconder ninguna noticia — solo
// ordena y, cuando hace falta, promueve alcances que faltarían arriba.
//
// Deliberadamente sin dependencias de lib/feed.ts (que sí importa de aquí)
// para evitar un import circular: este archivo solo conoce `News` y
// `UserLocation`, nunca `FeedItem`/`RankFn`.
//
// Pendiente (Etapa 3): afinidad por tema a partir de `users/{uid}/signals`
// (ver docs/senales.md). Se agrega como una señal más en el puntaje, nunca
// desplazando el piso anti-burbuja de abajo.
// ---------------------------------------------------------------------------

// Cuántas posiciones arriba del feed cuentan como "el tope" para la
// protección anti-burbuja (hero + large + el inicio de normal).
const TOP_WINDOW = 6

// Puntaje de cercanía a la ubicación elegida. Menor = más relevante.
function locationScore(n: News, loc: UserLocation): number {
  const sameCountry = n.country === loc.country
  const sameRegion = Boolean(loc.region) && n.region === loc.region
  if (n.scope === "local" && sameRegion) return 0
  if (n.scope === "national" && sameCountry) return 1
  if (n.scope === "international" && sameCountry) return 1
  if (n.scope === "local" && sameCountry) return 2
  if (n.scope === "international") return 3
  return 4 // local o nacional de otro país
}

// Desempate por validación: entre noticias igual de cercanas, la más
// confirmada va primero. NO es un filtro — una `unverified` sigue
// apareciendo siempre que exista, nunca se oculta ni se saca del feed, solo
// deja de ganarle a algo igual de relevante y mejor sustentado por pura
// coincidencia de ubicación. (Encontrado probando con datos reales: una
// noticia de fuente única sin confirmar terminó de "hero" por ser la única
// coincidencia de país para esa ubicación — ver docs/ciclos.md, 2026-10-10.)
function validationRank(n: News): number {
  if (n.validationStatus === "confirmed") return 0
  if (n.validationStatus === "in_progress") return 1
  return 2 // unverified
}

function compare(a: News, b: News, loc: UserLocation): number {
  const sa = locationScore(a, loc)
  const sb = locationScore(b, loc)
  if (sa !== sb) return sa - sb
  const va = validationRank(a)
  const vb = validationRank(b)
  if (va !== vb) return va - vb
  return newsDate(b).localeCompare(newsDate(a)) // más reciente primero
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

export type RankedNews = { items: News[]; protectedIds: Set<string> }

// Ordena por ubicación + recencia y aplica el piso anti-burbuja. No conoce
// FeedItem/prominencia: eso lo arma lib/feed.ts a partir de este resultado.
export function rankNewsByLocation(news: News[], location: UserLocation): RankedNews {
  const sorted = [...news].sort((a, b) => compare(a, b, location))
  return applyDiversityFloor(sorted)
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
