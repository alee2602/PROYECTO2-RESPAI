import { deleteField, serverTimestamp, type FieldValue } from "firebase/firestore"
import type { News } from "@respai/shared"

// Reglas del formulario de noticia, sin UI, para poder probarlas y reusarlas
// al crear y al editar. El flujo de validación completo está explicado en
// docs/validacion.md.

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
  validationNote: string // sin el prefijo de contradicción
  // La persona declara que las fuentes se contradicen. No es un campo del
  // esquema: se guarda como prefijo de validationNote (CONTRADICTION_PREFIX).
  contradicts: boolean
  // Confirmación de que alguien revisó el texto aportado por IA. Se pide en
  // cada guardado y no se guarda.
  aiReviewed: boolean
}

export const CONTRADICTION_PREFIX = "Fuentes contradictorias:"

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
  contradicts: false,
  aiReviewed: false,
})

export const MIN_SOURCES_TO_CONFIRM = 2

// Una fuente generada por IA nunca cuenta como prueba de que algo es verdad.
export function countsAsEvidence(s: DraftSource): boolean {
  return s.type !== "ai" && s.name.trim() !== ""
}

function normalize(text: string): string {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/\s+/g, " ").trim()
}

export function hostOf(url: string): string | null {
  try {
    return new URL(url.trim()).hostname.replace(/^www\./, "")
  } catch {
    return null
  }
}

// Dos fuentes son el mismo medio si tienen el mismo nombre (sin importar
// tildes ni mayúsculas) o la misma URL de dominio: dos artículos de Prensa
// Libre no se confirman entre sí. Devuelve, por cada fuente, el índice de la
// primera fuente de su grupo (-1 si no tiene nombre).
export function sourceGroups(sources: DraftSource[]): number[] {
  const groups: number[] = []
  sources.forEach((s, i) => {
    if (!s.name.trim()) return groups.push(-1)
    const name = normalize(s.name)
    const host = hostOf(s.url)
    const same = sources.findIndex(
      (o, j) => j < i && o.name.trim() && (normalize(o.name) === name || (host !== null && hostOf(o.url) === host))
    )
    groups.push(same === -1 ? i : groups[same]!)
  })
  return groups
}

// Cuántas fuentes distintas, que no sean IA, respaldan la noticia.
export function evidenceCount(sources: DraftSource[]): number {
  const groups = sourceGroups(sources)
  return new Set(groups.filter((g, i) => g !== -1 && countsAsEvidence(sources[i]!))).size
}

// En cuál de los casos del flujo de validación está la noticia (docs/validacion.md).
export type Diagnosis = "contradiction" | "insufficient" | "enough"

export function diagnose(d: NewsDraft): Diagnosis {
  if (d.contradicts) return "contradiction"
  return evidenceCount(d.sources) < MIN_SOURCES_TO_CONFIRM ? "insufficient" : "enough"
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

  // Aplican también a borradores: nunca se guarda "confirmada" sin evidencia
  // ni una contradicción declarada con otro estado que no sea "en desarrollo".
  if (d.validationStatus === "confirmed") {
    const evidence = evidenceCount(d.sources)
    if (evidence < MIN_SOURCES_TO_CONFIRM)
      errors.push(
        `Para marcarla como confirmada hacen falta al menos ${MIN_SOURCES_TO_CONFIRM} fuentes distintas que no sean IA (hay ${evidence}).`
      )
  }
  if (d.contradicts && d.validationStatus !== "in_progress")
    errors.push("Si las fuentes se contradicen, la noticia queda En desarrollo hasta que se aclare.")

  if (mode === "draft") return errors

  if (!d.summary.trim()) errors.push("Falta el resumen.")
  if (!d.body.trim()) errors.push("Falta el cuerpo de la noticia.")

  if (d.scope !== "international" && !d.country) errors.push("Elige el país de la noticia.")
  if (d.scope === "local" && !d.region) errors.push("Una noticia local necesita región.")

  const named = d.sources.filter((s) => s.name.trim())
  if (named.length === 0) errors.push("Agrega al menos una fuente: ninguna noticia se publica sin procedencia.")

  if (d.validationStatus !== "confirmed" && !d.validationNote.trim())
    errors.push("Explica en la nota de validación por qué no está confirmada (qué falta o qué se contradice).")

  if (d.contradicts && new Set(sourceGroups(d.sources).filter((g) => g !== -1)).size < 2)
    errors.push("Para declarar que las fuentes se contradicen, agrega al menos las 2 fuentes distintas en conflicto.")

  if (d.sources.some((s) => s.type === "ai" && s.name.trim()) && !d.aiReviewed)
    errors.push("Hay una fuente de IA: confirma que una persona revisó y editó ese texto antes de publicarlo.")

  return errors
}

// Campos de contenido comunes a crear y editar. Los opcionales vacíos quedan
// como `undefined`: al crear se omiten y al editar se borran del documento.
function contentFields(d: NewsDraft) {
  const sources: News["sources"] = d.sources
    .filter((s) => s.name.trim())
    .map((s) => ({ name: s.name.trim(), type: s.type, ...(s.url.trim() ? { url: s.url.trim() } : {}) }))
  const note = d.contradicts ? `${CONTRADICTION_PREFIX} ${d.validationNote.trim()}`.trim() : d.validationNote.trim()
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

  const note = str(data.validationNote)
  const contradicts = note.startsWith(CONTRADICTION_PREFIX)

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
    validationNote: contradicts ? note.slice(CONTRADICTION_PREFIX.length).trim() : note,
    contradicts,
    aiReviewed: false,
  }
}
