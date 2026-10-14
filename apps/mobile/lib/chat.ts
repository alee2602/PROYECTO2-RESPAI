import type { News } from "@respai/shared"
// Rutas relativas con extensión: se resuelven también en `node --test`.
import { VALIDATION_LABEL } from "./labels.ts"
import { parseLocation, type UserLocation } from "./locations.ts"
import type { RetrievalResult } from "./retrieval.ts"

// ---------------------------------------------------------------------------
// Contrato del chat (Rol 2): qué se le manda al endpoint y qué devuelve. Lo
// usan el endpoint (app/api/chat/) y la pantalla del chat, para que se puedan
// construir por separado sin chocar. Diseño completo: docs/chat.md.
//
// Idea central de Responsible AI: las CITAS y la NOTA DE INCERTIDUMBRE las
// arma este código a partir de las noticias recuperadas, NO el modelo. El
// modelo solo redacta el texto. Así no puede inventar una fuente ni omitir
// que algo no está confirmado.
//
// Módulo puro (sin Firebase, sin red).
// ---------------------------------------------------------------------------

// Cada pregunta es independiente: no se manda historial (más barato; el
// enunciado no exige memoria entre preguntas). Ver limitaciones en docs/chat.md.
export type ChatRequest = {
  question: string
  location: UserLocation // ubicación simulada, nunca GPS
}

export type Citation = {
  newsId: string
  title: string
  validationStatus: News["validationStatus"]
  validationLabel: string // "Confirmada" / "En desarrollo" / "No verificada" (mismos textos que el feed)
  validationNote?: string
  sources: News["sources"]
  publishedAt?: string
}

export type ChatAnswer = {
  kind: "answer"
  text: string
  citations: Citation[]
  // Aviso visible sobre lo que NO está confirmado o no se encontró. Lo arma el
  // código (uncertaintyNote), nunca el modelo. null = todo lo citado está confirmado.
  uncertainty: string | null
  // "model" → la pantalla muestra "Respuesta generada por IA".
  // "rules" → respuesta armada por código, sin modelo ($0).
  generatedBy: "model" | "rules"
}

export type NoAnswerReason =
  | "empty_question" // vacía o solo un saludo
  | "too_long" // protege el costo
  | "no_news" // ninguna noticia publicada responde a la pregunta
  | "off_topic" // pedido ajeno a las noticias (Rol 5, RC-14)
  | "rate_limited" // el usuario pasó su límite de preguntas (Rol 5, RC-17)
  | "chat_disabled" // un admin apagó el chat desde el portal (Rol 5, RC-20)
  | "budget_exhausted" // el saldo llegó a la reserva y el chat se apagó solo (Rol 5)
  | "unauthenticated"
  | "error"

export type ChatNoAnswer = {
  kind: "no_answer"
  reason: NoAnswerReason
  text: string // mensaje claro para la persona, nunca un error técnico
}

export type ChatResponse = ChatAnswer | ChatNoAnswer

export const CHAT_LIMITS = {
  maxQuestionChars: 300,
} as const

export const EXAMPLE_QUESTIONS = [
  "¿Qué pasó hoy?",
  "¿Qué noticias hay en mi región?",
  "Explícame la noticia de las elecciones en España",
  "¿Qué novedades hay de economía?",
] as const

// --- Validación de lo que llega al endpoint --------------------------------

// Devuelve null si el cuerpo no tiene la forma esperada. La pregunta se
// recorta; su largo se revisa después (para poder responder "too_long" con
// un mensaje claro en vez de un 400 genérico).
export function parseChatRequest(body: unknown): ChatRequest | null {
  if (!body || typeof body !== "object") return null
  const { question, location } = body as { question?: unknown; location?: unknown }
  if (typeof question !== "string") return null
  const loc = parseLocation(location)
  if (!loc) return null
  return { question: question.trim(), location: loc }
}

// --- Citas e incertidumbre (las arma el código, no el modelo) --------------

export function buildCitations(retrieval: RetrievalResult): Citation[] {
  return retrieval.items.map(({ news: n }) => ({
    newsId: n.id,
    title: n.title,
    validationStatus: n.validationStatus,
    validationLabel: VALIDATION_LABEL[n.validationStatus],
    ...(n.validationNote ? { validationNote: n.validationNote } : {}),
    sources: n.sources,
    ...(n.publishedAt ? { publishedAt: n.publishedAt } : {}),
  }))
}

function quoteList(items: string[]): string {
  return items.map((t) => `«${t}»`).join(", ")
}

// Nota visible sobre lo que no está confirmado o no se encontró. null si todo
// lo citado está confirmado y no faltó nada.
export function uncertaintyNote(citations: Citation[], unmatchedTerms: string[]): string | null {
  const parts: string[] = []
  const inProgress = citations.filter((c) => c.validationStatus === "in_progress")
  const unverified = citations.filter((c) => c.validationStatus === "unverified")
  if (inProgress.length > 0) {
    parts.push(`En desarrollo (todavía sin confirmar del todo): ${quoteList(inProgress.map((c) => c.title))}.`)
  }
  if (unverified.length > 0) {
    parts.push(`No verificada (no se ha podido confirmar): ${quoteList(unverified.map((c) => c.title))}.`)
  }
  if (unmatchedTerms.length > 0) {
    parts.push(`No encontré noticias publicadas sobre ${quoteList(unmatchedTerms)}, así que no puedo confirmar nada de eso.`)
  }
  return parts.length > 0 ? parts.join(" ") : null
}

// --- Respuestas sin modelo (paso 3) ----------------------------------------

// Si la pregunta se puede responder sin el modelo, devuelve esa respuesta
// ($0). Si devuelve null, hace falta el modelo para redactar.
export function answerWithoutModel(question: string, retrieval: RetrievalResult): ChatNoAnswer | null {
  const q = question.trim()

  if (q.length > CHAT_LIMITS.maxQuestionChars) {
    return {
      kind: "no_answer",
      reason: "too_long",
      text: `Tu pregunta es muy larga (máximo ${CHAT_LIMITS.maxQuestionChars} caracteres). Intenta hacerla más corta y concreta.`,
    }
  }

  const { intent } = retrieval
  const asksSomething =
    intent.terms.length > 0 || intent.places.length > 0 || intent.myRegion || intent.myCountry || intent.recent
  if (!asksSomething) {
    return {
      kind: "no_answer",
      reason: "empty_question",
      text: `Puedo responder sobre las noticias publicadas en la app. Prueba con algo como: ${EXAMPLE_QUESTIONS.map((e) => `«${e}»`).join(", ")}.`,
    }
  }

  if (retrieval.items.length === 0) {
    const about = retrieval.unmatchedTerms.length > 0 ? ` sobre ${quoteList(retrieval.unmatchedTerms)}` : " sobre eso"
    return {
      kind: "no_answer",
      reason: "no_news",
      text:
        `No encontré noticias publicadas${about}. No puedo confirmarlo: este chat solo responde con las noticias ` +
        `publicadas en la app, y una respuesta mía no es prueba de que algo sea cierto.`,
    }
  }

  return null
}

// Mensajes fijos para los casos que decide el endpoint (no la pregunta).
export const NO_ANSWER_TEXT: Record<
  "budget_exhausted" | "rate_limited" | "chat_disabled" | "off_topic" | "unauthenticated" | "error",
  string
> = {
  budget_exhausted:
    "El chat llegó a su límite de uso por ahora, para no agotar el presupuesto del proyecto. Mientras tanto puedes leer todas las noticias en tu portada.",
  rate_limited:
    "Hiciste muchas preguntas seguidas. Espera un momento y vuelve a intentar; mientras tanto puedes leer tu portada.",
  chat_disabled: "El chat está pausado por ahora. Puedes leer todas las noticias en tu portada.",
  off_topic:
    "Solo puedo responder sobre las noticias publicadas en la app. Prueba con una de las preguntas de ejemplo.",
  unauthenticated: "Tu sesión expiró. Vuelve a iniciar sesión para usar el chat.",
  error: "No pude responder en este momento. Intenta de nuevo en unos segundos.",
}
