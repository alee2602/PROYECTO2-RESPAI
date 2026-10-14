import {
  DEFAULT_CONFIG,
  addCounters,
  countersDelta,
  dayKey,
  decideRateLimit,
  emptyCounters,
  hourKey,
  type ChatConfig,
  type RateLimitState,
  type UsageCounters,
  type UsageRecord,
  type UserLimits,
} from "./usage.ts"

// ---------------------------------------------------------------------------
// Dónde vive el medidor (Rol 5). En producción, Firestore con el Admin SDK
// (usageStoreFirestore.ts). Acá, la interfaz y una versión EN MEMORIA para
// pruebas y para desarrollo local. Diseño: docs/medidor-gasto.md.
// ---------------------------------------------------------------------------

export interface UsageStore {
  // Interruptor y reserva (documento config/chat).
  getConfig(): Promise<ChatConfig>
  // Gasto acumulado (usage/totals.spentUsd); 0 si todavía no hay.
  getTotalSpend(): Promise<number>
  // Apaga el chat por la reserva. Idempotente: solo escribe si estaba
  // encendido, así dos preguntas a la vez no se pisan.
  disableChat(by: "reserve"): Promise<void>
  // Revisa y, si se permite, suma una pregunta del usuario. Atómico: dos
  // preguntas simultáneas no pueden pasar las dos el límite.
  consumeRateLimit(uid: string, now: Date, limits: UserLimits): Promise<boolean>
  // Suma una pregunta (con su camino y, si hubo modelo, sus tokens).
  record(rec: UsageRecord, now: Date): Promise<void>
}

export class MemoryUsageStore implements UsageStore {
  config: ChatConfig = DEFAULT_CONFIG
  totals: UsageCounters = emptyCounters()
  days = new Map<string, UsageCounters>()
  hours = new Map<string, UsageCounters>()
  rateLimits = new Map<string, RateLimitState>()
  disableWrites = 0 // cuántas veces disableChat cambió de verdad el estado

  async getConfig(): Promise<ChatConfig> {
    return this.config
  }

  async getTotalSpend(): Promise<number> {
    return this.totals.spentUsd
  }

  // Sin `await` entre leer y escribir: en memoria esto ya es atómico.
  async disableChat(by: "reserve"): Promise<void> {
    if (!this.config.enabled) return
    this.config = { ...this.config, enabled: false, disabledBy: by }
    this.disableWrites++
  }

  async consumeRateLimit(uid: string, now: Date, limits: UserLimits): Promise<boolean> {
    const { allowed, next } = decideRateLimit(this.rateLimits.get(uid) ?? null, now, limits)
    if (allowed) this.rateLimits.set(uid, next)
    return allowed
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
