import { collection, doc, getDoc, getDocs, type DocumentSnapshot } from "firebase/firestore"
import type { News } from "@respai/shared"
import { db } from "@/lib/firebase"
import { collectPublished, isPublished, parseNewsData, type PublishedNews } from "@/lib/newsParse"

// Lectura de noticias publicadas desde Firestore (colección `news`).
//
// Qué noticia se puede mostrar (fechas a ISO, sin estado de validación o sin
// fuentes → oculta) vive en lib/newsParse.ts, que es puro: así el endpoint del
// chat (servidor) aplica exactamente las mismas reglas que el feed.

export type { PublishedNews }

// Devuelve null si el documento no cumple lo mínimo para mostrarse.
export function parseNews(snap: DocumentSnapshot): News | null {
  return parseNewsData(snap.id, snap.data())
}

export async function fetchPublishedNews(): Promise<PublishedNews> {
  const snap = await getDocs(collection(db, "news"))
  return collectPublished(snap.docs.map((d) => ({ id: d.id, data: d.data() })))
}

export async function fetchNewsById(id: string): Promise<News | null> {
  const snap = await getDoc(doc(db, "news", id))
  if (!snap.exists() || !isPublished(snap.data())) return null
  return parseNews(snap)
}

export function newsDate(n: News): string {
  return n.publishedAt ?? n.createdAt
}
