import type { App } from "firebase-admin/app"
import { FieldValue, getFirestore, type Firestore } from "firebase-admin/firestore"
import {
  countersDelta,
  dayKey,
  decideRateLimit,
  hourKey,
  incrementFields,
  parseChatConfig,
  parseRateLimitState,
  type ChatConfig,
  type UsageRecord,
  type UserLimits,
} from "./usage.ts"
import type { UsageStore } from "./usageStore.ts"

// ---------------------------------------------------------------------------
// Medidor de gasto en Firestore (Rol 5). SOLO SERVIDOR (Admin SDK: no pasa por
// firestore.rules). Esquema: docs/medidor-gasto.md.
//   usage/totals, usage/totals/days/{día}, usage/totals/hours/{hora}
//   rate_limits/{uid}   config/chat
// ---------------------------------------------------------------------------

const CONFIG_TTL_MS = 30_000 // apagar el chat desde el portal tarda como máximo esto
let configCache: { value: ChatConfig; at: number } | null = null

export class FirestoreUsageStore implements UsageStore {
  db: Firestore

  constructor(app: App) {
    this.db = getFirestore(app)
  }

  async getConfig(): Promise<ChatConfig> {
    if (configCache && Date.now() - configCache.at < CONFIG_TTL_MS) return configCache.value
    const snap = await this.db.doc("config/chat").get()
    const value = parseChatConfig(snap.exists ? snap.data() : null)
    configCache = { value, at: Date.now() }
    return value
  }

  async getTotalSpend(): Promise<number> {
    const snap = await this.db.doc("usage/totals").get()
    const v = snap.exists ? snap.get("spentUsd") : 0
    return typeof v === "number" && Number.isFinite(v) ? v : 0
  }

  // Transacción: solo escribe si el chat seguía encendido. Si dos preguntas
  // cruzan la reserva a la vez, la segunda no cambia nada.
  async disableChat(by: "reserve"): Promise<void> {
    const ref = this.db.doc("config/chat")
    await this.db.runTransaction(async (tx) => {
      const snap = await tx.get(ref)
      if (!parseChatConfig(snap.exists ? snap.data() : null).enabled) return
      tx.set(ref, { enabled: false, disabledBy: by, updatedAt: FieldValue.serverTimestamp() }, { merge: true })
    })
    configCache = null // este servidor ve el apagado en el acto
  }

  // Transacción: dos preguntas simultáneas del mismo usuario no pueden pasar
  // las dos el límite.
  async consumeRateLimit(uid: string, now: Date, limits: UserLimits): Promise<boolean> {
    const ref = this.db.collection("rate_limits").doc(uid)
    return this.db.runTransaction(async (tx) => {
      const snap = await tx.get(ref)
      const prev = snap.exists ? parseRateLimitState(snap.data()) : null
      const { allowed, next } = decideRateLimit(prev, now, limits)
      if (allowed) tx.set(ref, { ...next, updatedAt: FieldValue.serverTimestamp() })
      return allowed
    })
  }

  // Incrementos atómicos en los 3 documentos a la vez: varios celulares no se pisan.
  async record(rec: UsageRecord, now: Date): Promise<void> {
    const fields = {
      ...incrementFields(countersDelta(rec), (n) => FieldValue.increment(n)),
      updatedAt: FieldValue.serverTimestamp(),
    }
    const batch = this.db.batch()
    for (const path of ["usage/totals", `usage/totals/days/${dayKey(now)}`, `usage/totals/hours/${hourKey(now)}`]) {
      batch.set(this.db.doc(path), fields, { merge: true })
    }
    await batch.commit()
  }
}
