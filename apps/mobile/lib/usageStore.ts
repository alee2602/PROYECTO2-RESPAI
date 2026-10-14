import {
  DEFAULT_CONFIG,
  addCounters,
  countersDelta,
  dayKey,
  decideRateLimit,
  emptyCounters,
  hourKey,
  type ChatConfig,
  type ChatLimits,
  type RateLimitState,
  type Spend,
  type UsageCounters,
  type UsageRecord,
} from "./usage.ts"

// ---------------------------------------------------------------------------
// Dónde vive el medidor (Rol 5). En producción, Firestore con el Admin SDK
// (usageStoreFirestore.ts). Acá, la interfaz y una versión EN MEMORIA para
// pruebas y para desarrollo local. Diseño: docs/medidor-gasto.md.
// ---------------------------------------------------------------------------

export interface UsageStore {
  // Interruptor y límites (documento config/chat).
  getConfig(): Promise<ChatConfig>
  // Revisa y, si se permite, suma una pregunta del usuario. Atómico: dos
  // preguntas simultáneas no pueden pasar las dos el límite.
  consumeRateLimit(uid: string, now: Date, limits: ChatLimits): Promise<boolean>
  // Gasto acumulado y de la hora actual, para el tope y el freno.
  getSpend(now: Date): Promise<Spend>
  // Suma una pregunta (con su camino y, si hubo modelo, sus tokens).
  record(rec: UsageRecord, now: Date): Promise<void>
}

export class MemoryUsageStore implements UsageStore {
  config: ChatConfig = DEFAULT_CONFIG
  totals: UsageCounters = emptyCounters()
  days = new Map<string, UsageCounters>()
  hours = new Map<string, UsageCounters>()
  rateLimits = new Map<string, RateLimitState>()

  async getConfig(): Promise<ChatConfig> {
    return this.config
  }

  // Sin `await` entre leer y escribir: en memoria esto ya es atómico.
  async consumeRateLimit(uid: string, now: Date, limits: ChatLimits): Promise<boolean> {
    const { allowed, next } = decideRateLimit(this.rateLimits.get(uid) ?? null, now, limits)
    if (allowed) this.rateLimits.set(uid, next)
    return allowed
  }

  async getSpend(now: Date): Promise<Spend> {
    return { totalUsd: this.totals.spentUsd, hourUsd: this.hours.get(hourKey(now))?.spentUsd ?? 0 }
  }

  async record(rec: UsageRecord, now: Date): Promise<void> {
    const delta = countersDelta(rec)
    this.totals = addCounters(this.totals, delta)
    const day = dayKey(now)
    const hour = hourKey(now)
    this.days.set(day, addCounters(this.days.get(day) ?? emptyCounters(), delta))
    this.hours.set(hour, addCounters(this.hours.get(hour) ?? emptyCounters(), delta))
  }
}
