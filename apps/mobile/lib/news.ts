import { collection, doc, getDoc, getDocs, Timestamp, type DocumentSnapshot } from "firebase/firestore"
import type { News } from "@respai/shared"
import { db } from "@/lib/firebase"

// Lectura de noticias publicadas desde Firestore (colección `news`).
//
// Dos ajustes respecto a lo que hay guardado, sin tocar el esquema:
// 1. Fechas: `News` las declara como string, pero las noticias semilla se
//    guardaron con serverTimestamp() (objeto Timestamp). Aquí se convierten a
//    texto ISO para que el resto de la app use el tipo tal cual.
// 2. Responsible AI: una noticia sin estado de validación válido o sin al menos
//    una fuente NO se muestra (regla de Rol 1: ninguna noticia sin estado ni
//    procedencia). Se cuenta como "oculta" para poder decirlo en pantalla.

const VALIDATION = ["confirmed", "in_progress", "unverified"] as const
const SCOPES = ["local", "national", "international"] as const
const SOURCE_TYPES = ["original", "summary", "ai"] as const
const IMAGE_ORIGINS = ["real_photo", "free_attributed", "ai_generated"] as const

function toIso(v: unknown): string | undefined {
  if (v instanceof Timestamp) return v.toDate().toISOString()
  if (typeof v === "string" && v) return v
  return undefined
}

function includes<T extends string>(list: readonly T[], v: unknown): v is T {
  return typeof v === "string" && (list as readonly string[]).includes(v)
}

// Devuelve null si el documento no cumple lo mínimo para mostrarse.
export function parseNews(snap: DocumentSnapshot): News | null {
  const d = snap.data()
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
    id: snap.id,
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

// "Publicada" = tiene publishedAt (lo pone el portal al publicar). Los
// borradores o documentos de prueba sin publishedAt no se muestran.
export async function fetchPublishedNews(): Promise<PublishedNews> {
  const snap = await getDocs(collection(db, "news"))
  let hidden = 0
  const items: News[] = []
  for (const d of snap.docs) {
    const raw = d.data()
    if (!raw.publishedAt) continue
    const n = parseNews(d)
    if (n) items.push(n)
    else hidden++
  }
  return { items, hidden }
}

export async function fetchNewsById(id: string): Promise<News | null> {
  const snap = await getDoc(doc(db, "news", id))
  if (!snap.exists() || !snap.data()?.publishedAt) return null
  return parseNews(snap)
}

export function newsDate(n: News): string {
  return n.publishedAt ?? n.createdAt
}
