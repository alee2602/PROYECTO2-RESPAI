import type { News } from "@respai/shared"

// Validación de un documento de `news` → `News`. Módulo puro (sin Firebase)
// para usarlo igual en el cliente (lib/news.ts, feed y lector) y en el
// servidor (endpoint del chat, que lee Firestore por REST). Así el chat aplica
// EXACTAMENTE las mismas reglas que el feed sobre qué noticia se puede mostrar.
//
// Dos ajustes respecto a lo que hay guardado, sin tocar el esquema:
// 1. Fechas: `News` las declara como string, pero las noticias se guardan con
//    serverTimestamp() (objeto Timestamp en el SDK; texto ISO en la API REST).
//    Aquí se convierten a texto ISO para que el resto de la app use el tipo tal cual.
// 2. Responsible AI: una noticia sin estado de validación válido o sin al menos
//    una fuente NO se muestra (regla de Rol 1: ninguna noticia sin estado ni
//    procedencia). Se cuenta como "oculta" para poder decirlo en pantalla.

const VALIDATION = ["confirmed", "in_progress", "unverified"] as const
const SCOPES = ["local", "national", "international"] as const
const SOURCE_TYPES = ["original", "summary", "ai"] as const
const IMAGE_ORIGINS = ["real_photo", "free_attributed", "ai_generated"] as const

// Acepta un Timestamp del SDK (cualquier objeto con toDate()) o un texto ISO.
// Sin importar Timestamp de firebase, para que este módulo siga siendo puro.
function toIso(v: unknown): string | undefined {
  if (v && typeof v === "object" && typeof (v as { toDate?: unknown }).toDate === "function") {
    return (v as { toDate: () => Date }).toDate().toISOString()
  }
  if (typeof v === "string" && v) return v
  return undefined
}

function includes<T extends string>(list: readonly T[], v: unknown): v is T {
  return typeof v === "string" && (list as readonly string[]).includes(v)
}

// "Publicada" = tiene publishedAt (lo pone el portal al publicar). Los
// borradores o documentos de prueba sin publishedAt no se muestran.
export function isPublished(d: Record<string, unknown> | undefined): boolean {
  return Boolean(d?.publishedAt)
}

// Devuelve null si el documento no cumple lo mínimo para mostrarse.
export function parseNewsData(id: string, d: Record<string, any> | undefined): News | null {
  if (!d) return null
  if (typeof d.title !== "string" || !d.title) return null
  if (!includes(VALIDATION, d.validationStatus)) return null
  if (!includes(SCOPES, d.scope)) return null

  const sources: News["sources"] = []
  for (const s of Array.isArray(d.sources) ? d.sources : []) {
    if (!s || typeof s.name !== "string" || !s.name || !includes(SOURCE_TYPES, s.type)) continue
    sources.push({ name: s.name, type: s.type, ...(typeof s.url === "string" && s.url ? { url: s.url } : {}) })
  }
  if (sources.length === 0) return null

  const image =
    d.image && typeof d.image.url === "string" && includes(IMAGE_ORIGINS, d.image.origin)
      ? {
          url: d.image.url as string,
          origin: d.image.origin,
          ...(typeof d.image.attribution === "string" ? { attribution: d.image.attribution as string } : {}),
        }
      : undefined

  const createdAt = toIso(d.createdAt) ?? toIso(d.publishedAt) ?? new Date(0).toISOString()

  return {
    id,
    title: d.title,
    summary: typeof d.summary === "string" ? d.summary : "",
    body: typeof d.body === "string" ? d.body : "",
    sources,
    authorId: typeof d.authorId === "string" ? d.authorId : "",
    validationStatus: d.validationStatus,
    ...(typeof d.validationNote === "string" && d.validationNote ? { validationNote: d.validationNote } : {}),
    scope: d.scope,
    ...(typeof d.country === "string" && d.country ? { country: d.country } : {}),
    ...(typeof d.region === "string" && d.region ? { region: d.region } : {}),
    topics: Array.isArray(d.topics) ? d.topics.filter((t: unknown): t is string => typeof t === "string") : [],
    ...(image ? { image } : {}),
    createdAt,
    ...(toIso(d.publishedAt) ? { publishedAt: toIso(d.publishedAt) } : {}),
    ...(toIso(d.updatedAt) ? { updatedAt: toIso(d.updatedAt) } : {}),
  }
}

export type PublishedNews = {
  items: News[]
  hidden: number // documentos descartados por no tener estado de validación o procedencia
}

// Separa publicadas válidas de publicadas inválidas (ocultas). Los borradores
// no cuentan en ninguno de los dos.
export function collectPublished(docs: { id: string; data: Record<string, unknown> | undefined }[]): PublishedNews {
  let hidden = 0
  const items: News[] = []
  for (const { id, data } of docs) {
    if (!isPublished(data)) continue
    const n = parseNewsData(id, data)
    if (n) items.push(n)
    else hidden++
  }
  return { items, hidden }
}
