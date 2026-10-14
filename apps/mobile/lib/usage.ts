import type { ModelUsage } from "./chatPipeline.ts"
import { WORST_CASE_COST_USD, costUsd } from "./pricing.ts"

// ---------------------------------------------------------------------------
// Medidor de gasto (Rol 5): tipos y decisiones PURAS (sin Firestore, sin red).
// Diseño: docs/medidor-gasto.md. Todas las claves de tiempo van en UTC.
// ---------------------------------------------------------------------------

// Qué camino tomó una pregunta. Solo "model" cuesta dinero.
export const USAGE_PATHS = [
  "model",
  "no_model",
  "off_topic",
  "rate_limited",
  "budget_blocked",
  "disabled",
  "simulated",
  "error",
] as const
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

// --- Config del chat (documento config/chat) --------------------------------

export type ChatLimits = {
  perMinute: number // preguntas por usuario por minuto (ráfaga)
  perDay: number // preguntas por usuario por día
  hourlyUsd: number // freno global: gasto máximo por hora
}

// PROVISIONALES: los valores son pregunta abierta (docs/costos.md). Se pueden
// cambiar sin desplegar desde config/chat.limits.
export const DEFAULT_LIMITS: ChatLimits = { perMinute: 5, perDay: 20, hourlyUsd: 1 }

export type ChatConfig = { enabled: boolean; limits: ChatLimits }

export const DEFAULT_CONFIG: ChatConfig = { enabled: true, limits: DEFAULT_LIMITS }

const isPositive = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v > 0

// Sin documento, el chat está encendido con los límites por defecto. Solo un
// `enabled: false` explícito lo apaga; un límite inválido usa el de defecto.
export function parseChatConfig(raw: unknown): ChatConfig {
  if (!raw || typeof raw !== "object") return DEFAULT_CONFIG
  const r = raw as { enabled?: unknown; limits?: unknown }
  const l = (r.limits && typeof r.limits === "object" ? r.limits : {}) as Record<string, unknown>
  return {
    enabled: r.enabled !== false,
    limits: {
      perMinute: isPositive(l.perMinute) ? l.perMinute : DEFAULT_LIMITS.perMinute,
      perDay: isPositive(l.perDay) ? l.perDay : DEFAULT_LIMITS.perDay,
      hourlyUsd: isPositive(l.hourlyUsd) ? l.hourlyUsd : DEFAULT_LIMITS.hourlyUsd,
    },
  }
}

// --- Presupuesto y tope -------------------------------------------------------

export type BudgetSettings = { budgetUsd: number; reserveUsd: number }

// De las variables de entorno BUDGET_USD y RESERVE_USD. Si algo está mal,
// devuelve null y el endpoint NO llama al modelo (falla cerrada).
export function parseBudgetEnv(env: Record<string, string | undefined>): BudgetSettings | null {
  if (!env.BUDGET_USD || !env.RESERVE_USD) return null
  const budgetUsd = Number(env.BUDGET_USD)
  const reserveUsd = Number(env.RESERVE_USD)
  if (!Number.isFinite(budgetUsd) || !Number.isFinite(reserveUsd)) return null
  if (budgetUsd <= 0 || reserveUsd < 0 || reserveUsd >= budgetUsd) return null
  return { budgetUsd, reserveUsd }
}

// Lo que se puede gastar antes de tocar la reserva de la demo.
export const capUsd = (b: BudgetSettings) => b.budgetUsd - b.reserveUsd

export type Spend = { totalUsd: number; hourUsd: number }

export type BudgetDecision = { allowed: true } | { allowed: false; why: "total" | "hourly" }

// Se compara con el PEOR caso de una llamada: aunque la llamada salga lo más
// cara posible, no se pasa del tope.
export function decideBudget(spend: Spend, budget: BudgetSettings, limits: ChatLimits): BudgetDecision {
  if (spend.totalUsd + WORST_CASE_COST_USD > capUsd(budget)) return { allowed: false, why: "total" }
  if (spend.hourUsd + WORST_CASE_COST_USD > limits.hourlyUsd) return { allowed: false, why: "hourly" }
  return { allowed: true }
}

// --- Límite por usuario (documento rate_limits/{uid}) ------------------------

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
  limits: ChatLimits
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
