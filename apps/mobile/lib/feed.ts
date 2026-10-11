import type { News } from "@respai/shared"
import type { TopicAffinity } from "@/lib/affinity"
import type { UserLocation } from "@/lib/locations"
import { newsDate } from "@/lib/news"
import { displayScope, rankNewsByLocation } from "@/lib/ranking"

// Re-exportado para que quien ya importa de aquí (reasonFor, FeedItem) no
// tenga que importar también de lib/ranking directamente.
export { displayScope } from "@/lib/ranking"

// ---------------------------------------------------------------------------
// Punto de integración con Rol 4 (ranking + anti-burbuja).
//
// La app solo necesita una lista de FeedItem ya ordenada. Mientras Rol 4 no
// entregue su ranking, se usa `fallbackFeed`: un orden PROVISIONAL y simple por
// cercanía a la ubicación simulada + recencia. No usa ningún modelo, no lee
// señales de comportamiento y NO esconde ninguna noticia (solo las ordena).
//
// Para conectar el ranking de Rol 4: implementar `RankFn` (por ejemplo en
// packages/shared) y cambiar `rankFeed` abajo. Si Rol 4 entrega su propia
// prominencia o explicación, se respetan; si no, se completan aquí.
// ---------------------------------------------------------------------------

export type Prominence = "hero" | "large" | "normal" | "compact"

export type FeedItem = {
  news: News
  prominence: Prominence
  reason: string // "por qué aparece", corto, en español
  protectedByDiversity?: boolean // true si entró por la protección anti-burbuja (Rol 4)
  displayScope: News["scope"] // etiqueta Local/Nacional/Internacional, relativa a TU ubicación (ver displayScope())
}

export type RankFn = (news: News[], location: UserLocation, affinity?: TopicAffinity) => FeedItem[]

// Prominencia por posición (fallback mientras Rol 4 no la calcule).
export function prominenceByPosition(index: number): Prominence {
  if (index === 0) return "hero"
  if (index <= 2) return "large"
  if (index <= 6) return "normal"
  return "compact"
}


// Explicación derivada de alcance + ubicación (fallback).
export function reasonFor(n: News, loc: UserLocation): string {
  const sameCountry = n.country === loc.country
  const sameRegion = Boolean(loc.region) && n.region === loc.region
  if (n.scope === "local") {
    if (sameRegion) return `Ocurre en tu región (${loc.region})`
    if (sameCountry) return `Noticia local de ${n.region ?? n.country}, en tu país`
    return `Noticia local de ${n.region ? `${n.region}, ` : ""}${n.country ?? "otro país"}`
  }
  if (n.scope === "national") {
    if (sameCountry) return sameRegion ? `Noticia nacional que toca tu región` : `Noticia nacional de tu país`
    return `Noticia nacional de ${n.country ?? "otro país"}`
  }
  if (sameCountry) return `Ocurre en tu país (${loc.country})`
  return n.country ? `Noticia internacional · ${n.country}` : "Noticia internacional"
}

// Cercanía: 0 = lo más cercano. Solo ordena, no filtra.
function proximity(n: News, loc: UserLocation): number {
  const sameCountry = n.country === loc.country
  const sameRegion = Boolean(loc.region) && n.region === loc.region
  if (n.scope === "local" && sameRegion) return 0
  if (n.scope === "national" && sameCountry) return 1
  // "Internacional" vista desde quien la cargó, pero ocurre en el país del usuario
  if (n.scope === "international" && sameCountry) return 1
  if (n.scope === "local" && sameCountry) return 2
  if (n.scope === "international") return 3
  return 4 // local o nacional de otro país
}

export const fallbackFeed: RankFn = (news, location) => {
  const sorted = [...news].sort(
    (a, b) => proximity(a, location) - proximity(b, location) || newsDate(b).localeCompare(newsDate(a))
  )
  return sorted.map((n, i) => ({
    news: n,
    prominence: prominenceByPosition(i),
    reason: reasonFor(n, location),
    displayScope: displayScope(n, location),
  }))
}

// Ranking real de Rol 4: ubicación + validación + recencia + afinidad por tema,
// con protección anti-burbuja. La lógica de puntaje/orden vive en
// lib/ranking.ts (sin depender de este archivo, para evitar un import
// circular); aquí solo se arma el FeedItem[] con prominencia y explicación.
// `fallbackFeed` se deja exportado como referencia/respaldo, ya no se usa.
export const rankFeed: RankFn = (news, location, affinity) => {
  const { items, protectedIds, affinityTopics } = rankNewsByLocation(news, location, affinity)
  return items.map((n, i): FeedItem => {
    const isProtected = protectedIds.has(n.id)
    const topic = affinityTopics.get(n.id)
    let reason = reasonFor(n, location)
    if (topic) reason += ` · sigues el tema ${topic}`
    if (isProtected) reason += " · parte de la mezcla de alcances de tu feed"
    return {
      news: n,
      prominence: prominenceByPosition(i),
      reason,
      displayScope: displayScope(n, location),
      ...(isProtected ? { protectedByDiversity: true } : {}),
    }
  })
}
