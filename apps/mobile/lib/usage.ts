import type { ModelUsage } from "./chatPipeline.ts"
import { WORST_CASE_COST_USD, costUsd } from "./pricing.ts"

// ---------------------------------------------------------------------------
// Medidor de gasto (Rol 5): tipos y decisiones PURAS (sin Firestore, sin red).
// Diseño: docs/medidor-gasto.md. Todas las claves de tiempo van en UTC.
//
// Lo ÚNICO que frena el modelo (decisión 2026-10-13): los límites por
// usuario, el interruptor y la reserva (que apaga el interruptor sola).
// El presupuesto de USD 20 es fijo e informativo.
// ---------------------------------------------------------------------------

// Qué camino tomó una pregunta. Solo "model" cuesta dinero. Una pregunta
// frenada por el interruptor o por la reserva cuenta como "disabled".
export const USAGE_PATHS = ["model", "no_model", "off_topic", "rate_limited", "disabled", "simulated", "error"] as const
export type UsagePath = (typeof USAGE_PATHS)[number]

export type UsageCounters = {
  spentUsd: number
  inputTokens: number
  outputTokens: number
  questions: Record<UsagePath, number>
}

export function emptyCounters(): UsageCounters {
  const questions = Object.fromEntries(USAGE_PATHS.map((p) => [p, 0])) as Record<UsagePath, number>
  return { spentUsd: 0, inputTokens: 0, outputTokens: 0, questions }
}

export type UsageRecord = { path: UsagePath; usage?: ModelUsage }

// Lo que suma UNA pregunta. Sin texto de la pregunta ni datos del usuario.
export function countersDelta(rec: UsageRecord): UsageCounters {
  const d = emptyCounters()
  d.questions[rec.path] = 1
  if (rec.usage) {
    d.inputTokens = rec.usage.inputTokens
    d.outputTokens = rec.usage.outputTokens
    d.spentUsd = costUsd(rec.usage)
  }
  return d
}

export function addCounters(a: UsageCounters, b: UsageCounters): UsageCounters {
  const questions = { ...a.questions }
  for (const p of USAGE_PATHS) questions[p] += b.questions[p]
  return {
    spentUsd: a.spentUsd + b.spentUsd,
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    questions,
  }
}

// Documento de incrementos para Firestore. `inc` es FieldValue.increment en
// producción; acá se recibe como parámetro para poder probarlo sin Firebase.
export function incrementFields<T>(delta: UsageCounters, inc: (n: number) => T): Record<string, unknown> {
  const questions: Record<string, T> = {}
  for (const p of USAGE_PATHS) if (delta.questions[p]) questions[p] = inc(delta.questions[p])
  return {
    spentUsd: inc(delta.spentUsd),
    inputTokens: inc(delta.inputTokens),
    outputTokens: inc(delta.outputTokens),
    questions,
  }
}

// --- Claves de tiempo (UTC) ------------------------------------------------

export const dayKey = (d: Date) => d.toISOString().slice(0, 10) // YYYY-MM-DD
export const hourKey = (d: Date) => d.toISOString().slice(0, 13) // YYYY-MM-DDTHH
export const minuteKey = (d: Date) => d.toISOString().slice(0, 16) // YYYY-MM-DDTHH:MM

// --- Presupuesto y reserva ---------------------------------------------------

// Fijos para este proyecto. El portal tiene una copia (apps/admin/lib/costs.ts):
// si cambian acá, cambiar allá. Contrato en docs/medidor-gasto.md.
export const BUDGET_USD = 20
export const DEFAULT_RESERVE_USD = 10

// --- Límites por usuario (documento rate_limits/{uid}) ------------------------

export type UserLimits = {
  perMinute: number // preguntas por usuario por minuto (ráfaga)
  perDay: number // preguntas por usuario por día
}

// PROVISIONALES: los valores son pregunta abierta (docs/costos.md).
export const USER_LIMITS: UserLimits = { perMinute: 5, perDay: 20 }

// --- config/chat (contrato con el portal) -------------------------------------

export type DisabledBy = "admin" | "reserve"

export type ChatConfig = {
  enabled: boolean // interruptor
  reserveUsd: number // 0–20, editable en el tablero
  disabledBy: DisabledBy | null // quién lo apagó la última vez
}

export const DEFAULT_CONFIG: ChatConfig = { enabled: true, reserveUsd: DEFAULT_RESERVE_USD, disabledBy: null }

// Sin documento: encendido, reserva 10. Solo un `enabled: false` explícito
// apaga; una reserva inválida vale 10; campos de más (p. ej. el viejo
// `limits`) se ignoran.
export function parseChatConfig(raw: unknown): ChatConfig {
  if (!raw || typeof raw !== "object") return DEFAULT_CONFIG
  const r = raw as Record<string, unknown>
  const reserve = r.reserveUsd
  const validReserve = typeof reserve === "number" && Number.isFinite(reserve) && reserve >= 0 && reserve <= BUDGET_USD
  return {
    enabled: r.enabled !== false,
    reserveUsd: validReserve ? reserve : DEFAULT_RESERVE_USD,
    disabledBy: r.disabledBy === "admin" || r.disabledBy === "reserve" ? r.disabledBy : null,
  }
}

// ¿Se puede hacer una llamada más sin que el saldo baje de la reserva?
// Se compara con el PEOR caso de una llamada (lib/pricing.ts).
export function decideReserve(spentUsd: number, reserveUsd: number): boolean {
  return BUDGET_USD - spentUsd - WORST_CASE_COST_USD >= reserveUsd
}

// --- Límite por usuario --------------------------------------------------------

export type RateLimitState = { minute: string; minuteCount: number; day: string; dayCount: number }

export function parseRateLimitState(raw: unknown): RateLimitState | null {
  if (!raw || typeof raw !== "object") return null
  const r = raw as Record<string, unknown>
  if (typeof r.minute !== "string" || typeof r.day !== "string") return null
  if (typeof r.minuteCount !== "number" || typeof r.dayCount !== "number") return null
  return { minute: r.minute, minuteCount: r.minuteCount, day: r.day, dayCount: r.dayCount }
}

// Ventanas fijas: si la ventana guardada no es la actual, su contador vuelve
// a 0. Una pregunta bloqueada no suma.
export function decideRateLimit(
  prev: RateLimitState | null,
  now: Date,
  limits: UserLimits
): { allowed: boolean; next: RateLimitState } {
  const minute = minuteKey(now)
  const day = dayKey(now)
  const minuteCount = prev && prev.minute === minute ? prev.minuteCount : 0
  const dayCount = prev && prev.day === day ? prev.dayCount : 0
  if (minuteCount >= limits.perMinute || dayCount >= limits.perDay) {
    return { allowed: false, next: { minute, minuteCount, day, dayCount } }
  }
  return { allowed: true, next: { minute, minuteCount: minuteCount + 1, day, dayCount: dayCount + 1 } }
}

// --- Errores del modelo que igual se cobraron --------------------------------

// El modelo respondió (y cobró) pero la respuesta no sirve: refusal o sin
// texto. Lleva el uso para poder registrar el costo.
export class PaidModelError extends Error {
  usage: ModelUsage
  constructor(message: string, usage: ModelUsage) {
    super(message)
    this.name = "PaidModelError"
    this.usage = usage
  }
}
