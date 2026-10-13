// Rutas relativas con extensión: se resuelven también en `node --test`.
import { collectPublished, type PublishedNews } from "./newsParse.ts"

// ---------------------------------------------------------------------------
// Lectura de `news` desde el SERVIDOR (endpoint del chat) con la API REST de
// Firestore y el token de sesión del propio usuario.
//
// Por qué así y no con una cuenta de servicio: el servidor "muestra el carnet"
// del usuario. Firestore aplica las mismas reglas de seguridad que en la app
// (firestore.rules: leer `news` exige sesión), rechaza un token falso o
// vencido, y no hace falta guardar ningún secreto nuevo en Vercel.
//
// Por qué el servidor lee las noticias en vez de recibirlas del celular: si
// las mandara el cliente, alguien podría inyectar una noticia falsa y el chat
// la citaría como publicada.
// ---------------------------------------------------------------------------

// Valor de un campo en el formato de la API REST de Firestore.
export type FirestoreValue = {
  stringValue?: string
  integerValue?: string
  doubleValue?: number
  booleanValue?: boolean
  nullValue?: null
  timestampValue?: string
  referenceValue?: string
  arrayValue?: { values?: FirestoreValue[] }
  mapValue?: { fields?: Record<string, FirestoreValue> }
}

type FirestoreDocument = { name: string; fields?: Record<string, FirestoreValue> }

// REST → valor JS simple. Las fechas quedan como texto ISO, que es lo que
// espera parseNewsData.
export function fromFirestoreValue(v: FirestoreValue): unknown {
  if ("stringValue" in v) return v.stringValue
  if ("timestampValue" in v) return v.timestampValue
  if ("integerValue" in v) return Number(v.integerValue)
  if ("doubleValue" in v) return v.doubleValue
  if ("booleanValue" in v) return v.booleanValue
  if ("nullValue" in v) return null
  if ("referenceValue" in v) return v.referenceValue
  if ("arrayValue" in v) return (v.arrayValue?.values ?? []).map(fromFirestoreValue)
  if ("mapValue" in v) return fromFirestoreFields(v.mapValue?.fields)
  return undefined
}

export function fromFirestoreFields(fields: Record<string, FirestoreValue> | undefined): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(fields ?? {})) out[k] = fromFirestoreValue(v)
  return out
}

// "projects/p/databases/(default)/documents/news/abc123" → "abc123"
export function documentId(name: string): string {
  return name.slice(name.lastIndexOf("/") + 1)
}

export class UnauthenticatedError extends Error {}

const MAX_PAGES = 5 // tope de seguridad: 5 × 300 = 1.500 noticias, de sobra para el proyecto

// Lee todas las noticias y devuelve solo las publicadas y válidas (mismas
// reglas que el feed). Cada documento leído cuenta como una lectura de
// Firestore (plan Spark: 50.000/día).
export async function fetchPublishedNewsRest(projectId: string, idToken: string): Promise<PublishedNews> {
  const base = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/news`
  const docs: FirestoreDocument[] = []
  let pageToken: string | undefined

  for (let page = 0; page < MAX_PAGES; page++) {
    const url = `${base}?pageSize=300${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ""}`
    const res = await fetch(url, { headers: { Authorization: `Bearer ${idToken}` }, cache: "no-store" })
    // 401: token inválido o vencido. 403: las reglas lo rechazan (sin sesión).
    if (res.status === 401 || res.status === 403) throw new UnauthenticatedError(`Firestore ${res.status}`)
    if (!res.ok) throw new Error(`Firestore respondió ${res.status}`)
    const body = (await res.json()) as { documents?: FirestoreDocument[]; nextPageToken?: string }
    docs.push(...(body.documents ?? []))
    pageToken = body.nextPageToken
    if (!pageToken) break
  }

  return collectPublished(docs.map((d) => ({ id: documentId(d.name), data: fromFirestoreFields(d.fields) })))
}
