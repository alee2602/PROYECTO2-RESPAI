// ---------------------------------------------------------------------------
// Tablero de costos del chat (Rol 5): lógica PURA, sin Firebase, probada con
// node --test. Los componentes de /costos solo muestran lo que sale de acá.
//
// Contrato con la app (config/chat y usage/*): docs/medidor-gasto.md.
// Las constantes y la lectura de config/chat están DUPLICADAS a propósito de
// apps/mobile/lib/usage.ts y lib/pricing.ts (no se comparte código entre app
// y portal). Si cambian allá, cambiarlas acá.
//
// Privacidad: solo números de uso; nada del contenido de las conversaciones.
// ---------------------------------------------------------------------------

export const BUDGET_USD = 20 // fijo, informativo
export const DEFAULT_RESERVE_USD = 10
export const WORST_CASE_COST_USD = 0.000425 // apps/mobile/lib/pricing.ts: 2.500 de entrada + 350 de salida

export type PathKey = "model" | "no_model" | "off_topic" | "rate_limited" | "disabled" | "simulated" | "error"

export const KNOWN_PATHS: readonly (readonly [PathKey, string])[] = [
  ["model", "Con modelo"],
  ["no_model", "Sin modelo (reglas)"],
  ["off_topic", "Fuera de tema"],
  ["rate_limited", "Frenadas por el límite por usuario"],
  ["disabled", "Chat apagado"],
  ["simulated", "Modo de prueba"],
  ["error", "Error"],
]

// --- config/chat ---------------------------------------------------------------

export type ChatConfig = { enabled: boolean; reserveUsd: number; disabledBy: "admin" | "reserve" | null }

export const DEFAULT_CONFIG: ChatConfig = { enabled: true, reserveUsd: DEFAULT_RESERVE_USD, disabledBy: null }

export function parseConfig(raw: unknown): ChatConfig {
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

// --- Contadores (usage/totals, días y horas) ----------------------------------------

export type Counters = {
  exists: boolean
  invalid: boolean // algún campo no era un número válido (se tomó como 0)
  spentUsd: number
  inputTokens: number
  outputTokens: number
  questions: Record<PathKey, number>
  totalQuestions: number
}

export function parseCounters(raw: unknown): Counters {
  const questions = Object.fromEntries(KNOWN_PATHS.map(([k]) => [k, 0])) as Record<PathKey, number>
  if (!raw || typeof raw !== "object") {
    return { exists: false, invalid: false, spentUsd: 0, inputTokens: 0, outputTokens: 0, questions, totalQuestions: 0 }
  }
  let invalid = false
  const num = (v: unknown): number => {
    if (v === undefined) return 0
    if (typeof v === "number" && Number.isFinite(v) && v >= 0) return v
    invalid = true
    return 0
  }
  const r = raw as Record<string, unknown>
  let q: Record<string, unknown> = {}
  if (r.questions !== undefined) {
    if (r.questions && typeof r.questions === "object") q = r.questions as Record<string, unknown>
    else invalid = true
  }
  for (const [k] of KNOWN_PATHS) questions[k] = num(q[k]) // los caminos desconocidos se ignoran
  const spentUsd = num(r.spentUsd)
  const inputTokens = num(r.inputTokens)
  const outputTokens = num(r.outputTokens)
  const totalQuestions = KNOWN_PATHS.reduce((sum, [k]) => sum + questions[k], 0)
  return { exists: true, invalid, spentUsd, inputTokens, outputTokens, questions, totalQuestions }
}

// --- Dinero --------------------------------------------------------------------

export type Money = { budget: number; spent: number; balance: number; reserve: number; available: number }

export function moneySummary(spentUsd: number, reserveUsd: number): Money {
  const balance = BUDGET_USD - spentUsd
  return { budget: BUDGET_USD, spent: spentUsd, balance, reserve: reserveUsd, available: Math.max(0, balance - reserveUsd) }
}

const pct = (usd: number) => Math.min(100, Math.max(0, (usd / BUDGET_USD) * 100))

// Barra apilada sobre los USD 20: gastado | disponible | reserva.
export function barSegments(m: Money) {
  const spentPct = pct(m.spent)
  const reservePct = Math.min(pct(Math.min(m.reserve, Math.max(0, m.balance))), 100 - spentPct)
  const availablePct = Math.min(pct(m.available), 100 - spentPct - reservePct)
  return { spentPct, availablePct, reservePct }
}

// --- Ahorro --------------------------------------------------------------------

// Preguntas que no llegaron al modelo × costo promedio real de una que sí.
export function savingsEstimate(c: Counters) {
  if (c.questions.model === 0) return null
  const avgModelCostUsd = c.spentUsd / c.questions.model
  const avoidedQuestions = c.questions.no_model + c.questions.off_topic + c.questions.rate_limited + c.questions.disabled
  return { avgModelCostUsd, avoidedQuestions, savedUsd: avoidedQuestions * avgModelCostUsd }
}

// --- Estado del chat -------------------------------------------------------------

export type ChatStateKind = "on" | "off_admin" | "off_reserve"

// wouldReDisable: el saldo ya está bajo la reserva, así que encenderlo haría
// que la próxima pregunta lo vuelva a apagar (misma regla que la app).
export function chatState(config: ChatConfig, spentUsd: number): { state: ChatStateKind; wouldReDisable: boolean } {
  const state: ChatStateKind = config.enabled ? "on" : config.disabledBy === "reserve" ? "off_reserve" : "off_admin"
  const wouldReDisable = BUDGET_USD - spentUsd - WORST_CASE_COST_USD < config.reserveUsd
  return { state, wouldReDisable }
}

// --- Campo de la reserva ---------------------------------------------------------

export function validateReserveInput(text: string): { ok: true; value: number } | { ok: false; message: string } {
  const t = text.trim().replace(",", ".")
  if (!t) return { ok: false, message: "Escribe un monto en USD, de 0 a 20." }
  if (!/^\d+(\.\d+)?$/.test(t)) return { ok: false, message: "Solo números, con punto o coma decimal (por ejemplo 10 o 19,5)." }
  const value = Number(t)
  if (value > BUDGET_USD) return { ok: false, message: "La reserva no puede ser mayor que el presupuesto (USD 20)." }
  return { ok: true, value }
}

// --- Estados de lectura ------------------------------------------------------------

export type DocStatus = "loading" | "missing" | "ok" | "denied" | "error"

export const DENIED_TEXT = "Las reglas del medidor no están desplegadas o tu correo no es admin."

// Solo el código del error, nunca su mensaje ni la pila.
export function docStatusMessage(s: { status: DocStatus; code?: string }, missingText: string): string | null {
  switch (s.status) {
    case "ok":
      return null
    case "loading":
      return "Cargando…"
    case "missing":
      return missingText
    case "denied":
      return DENIED_TEXT
    case "error":
      return `No se pudo leer (${s.code ?? "desconocido"}).`
  }
}

// --- Formato y claves (UTC, como la app) -------------------------------------------

export function formatUsd(n: number): string {
  return `USD ${n.toFixed(Math.abs(n) < 1 ? 4 : 2)}`
}

export const dayKey = (d: Date) => d.toISOString().slice(0, 10)
export const hourKey = (d: Date) => d.toISOString().slice(0, 13)
