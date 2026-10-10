import { deleteField, serverTimestamp, type FieldValue } from "firebase/firestore"
import type { News } from "@respai/shared"

// Reglas del formulario de noticia, sin UI, para poder probarlas y reusarlas
// (crear ahora, editar y validar en los siguientes PRs del Rol 3).

export type SourceType = News["sources"][number]["type"]
const SOURCE_TYPE_VALUES = ["original", "summary", "ai"] as const satisfies readonly SourceType[]

export type DraftSource = { name: string; url: string; type: SourceType }

// Estado del formulario: todo como texto, tal cual lo escribe la persona.
export type NewsDraft = {
  title: string
  summary: string
  body: string
  scope: News["scope"]
  country: string
  region: string // "" = todo el país
  topics: string // separados por coma
  sources: DraftSource[]
  validationStatus: News["validationStatus"]
  validationNote: string
}

export const emptyDraft = (): NewsDraft => ({
  title: "",
  summary: "",
  body: "",
  scope: "local",
  country: "",
  region: "",
  topics: "",
  sources: [{ name: "", url: "", type: "original" }],
  validationStatus: "unverified",
  validationNote: "",
})

export const MIN_SOURCES_TO_CONFIRM = 2

// Una fuente generada por IA nunca cuenta como prueba de que algo es verdad.
export function countsAsEvidence(s: DraftSource): boolean {
  return s.type !== "ai" && s.name.trim() !== ""
}

export function parseTopics(raw: string): string[] {
  const seen = new Set<string>()
  for (const t of raw.split(",")) {
    const topic = t.trim().toLowerCase()
    if (topic) seen.add(topic)
  }
  return [...seen]
}

function isHttpUrl(raw: string): boolean {
  try {
    const u = new URL(raw)
    return u.protocol === "http:" || u.protocol === "https:"
  } catch {
    return false
  }
}

// Devuelve la lista de problemas (vacía = se puede guardar). Un borrador solo
// necesita título (y no puede decir "confirmada" sin evidencia); publicar
// exige la noticia completa.
export function validateDraft(d: NewsDraft, mode: "draft" | "publish"): string[] {
  const errors: string[] = []
  if (!d.title.trim()) errors.push("Falta el título.")

  d.sources.forEach((s, i) => {
    if (s.url.trim() && !isHttpUrl(s.url.trim()))
      errors.push(`La URL de la fuente ${i + 1} no es válida (debe empezar con http:// o https://).`)
    if (s.url.trim() && !s.name.trim()) errors.push(`La fuente ${i + 1} tiene URL pero no nombre.`)
  })

  // Aplica también a borradores: nunca se guarda "confirmada" sin evidencia.
  if (d.validationStatus === "confirmed") {
    const evidence = d.sources.filter(countsAsEvidence).length
    if (evidence < MIN_SOURCES_TO_CONFIRM)
      errors.push(
        `Para marcarla como confirmada hacen falta al menos ${MIN_SOURCES_TO_CONFIRM} fuentes que no sean IA (hay ${evidence}).`
      )
  }

  if (mode === "draft") return errors

  if (!d.summary.trim()) errors.push("Falta el resumen.")
  if (!d.body.trim()) errors.push("Falta el cuerpo de la noticia.")

  if (d.scope !== "international" && !d.country) errors.push("Elige el país de la noticia.")
  if (d.scope === "local" && !d.region) errors.push("Una noticia local necesita región.")

  const named = d.sources.filter((s) => s.name.trim())
  if (named.length === 0) errors.push("Agrega al menos una fuente: ninguna noticia se publica sin procedencia.")

  if (d.validationStatus !== "confirmed" && !d.validationNote.trim())
    errors.push("Explica en la nota de validación por qué no está confirmada (qué falta o qué se contradice).")

  return errors
}

// Campos de contenido comunes a crear y editar. Los opcionales vacíos quedan
// como `undefined`: al crear se omiten y al editar se borran del documento.
function contentFields(d: NewsDraft) {
  const sources: News["sources"] = d.sources
    .filter((s) => s.name.trim())
    .map((s) => ({ name: s.name.trim(), type: s.type, ...(s.url.trim() ? { url: s.url.trim() } : {}) }))
  const note = d.validationNote.trim()
  const country = d.country.trim()
  const region = d.scope === "international" ? "" : d.region

  return {
    title: d.title.trim(),
    summary: d.summary.trim(),
    body: d.body.trim(),
    sources,
    validationStatus: d.validationStatus,
    validationNote: note || undefined,
    scope: d.scope,
    country: country || undefined,
    region: region || undefined,
    topics: parseTopics(d.topics),
  }
}

// Documento tal como se guarda en `news`. Fechas con serverTimestamp(), igual
// que las noticias semilla (la app ya las convierte a texto al leer). Firestore
// no acepta `undefined`, por eso los campos opcionales vacíos no se incluyen.
export type NewsDoc = Omit<News, "id" | "createdAt" | "publishedAt" | "updatedAt"> & {
  createdAt: FieldValue
  publishedAt?: FieldValue
}

export function toNewsDoc(d: NewsDraft, authorId: string, publish: boolean): NewsDoc {
  const fields = Object.fromEntries(Object.entries(contentFields(d)).filter(([, v]) => v !== undefined))
  return {
    ...(fields as ReturnType<typeof contentFields>),
    authorId,
    createdAt: serverTimestamp(),
    ...(publish ? { publishedAt: serverTimestamp() } : {}),
  }
}

// Cambios para updateDoc al editar. No toca `authorId`, `createdAt` ni
// `image` (la imagen tiene su propio flujo); un opcional que se vació se borra.
export function toNewsUpdate(d: NewsDraft): Record<string, unknown> {
  const update: Record<string, unknown> = { updatedAt: serverTimestamp() }
  for (const [key, value] of Object.entries(contentFields(d))) update[key] = value === undefined ? deleteField() : value
  return update
}

// Al revés: un documento de Firestore (puede venir incompleto, por ejemplo las
// noticias semilla viejas) convertido al estado del formulario.
export function draftFromDoc(data: Record<string, unknown>): NewsDraft {
  const str = (v: unknown) => (typeof v === "string" ? v : "")
  const pick = <T extends string>(v: unknown, options: readonly T[], fallback: T): T =>
    options.includes(v as T) ? (v as T) : fallback

  const sources: DraftSource[] = (Array.isArray(data.sources) ? data.sources : [])
    .filter((s): s is Record<string, unknown> => !!s && typeof s === "object")
    .map((s) => ({ name: str(s.name), url: str(s.url), type: pick(s.type, SOURCE_TYPE_VALUES, "original") }))

  return {
    title: str(data.title),
    summary: str(data.summary),
    body: str(data.body),
    scope: pick(data.scope, ["local", "national", "international"] as const, "local"),
    country: str(data.country),
    region: str(data.region),
    topics: (Array.isArray(data.topics) ? data.topics.filter((t) => typeof t === "string") : []).join(", "),
    sources: sources.length ? sources : emptyDraft().sources,
    validationStatus: pick(data.validationStatus, ["confirmed", "in_progress", "unverified"] as const, "unverified"),
    validationNote: str(data.validationNote),
  }
}
