import type { App } from "firebase-admin/app"
import { FieldValue, getFirestore, type DocumentSnapshot, type Firestore } from "firebase-admin/firestore"
import {
  countersDelta,
  dayKey,
  decideRateLimit,
  hourKey,
  incrementFields,
  parseChatConfig,
  parseRateLimitState,
  type ChatConfig,
  type ChatLimits,
  type Spend,
  type UsageRecord,
} from "./usage.ts"
import type { UsageStore } from "./usageStore.ts"

// ---------------------------------------------------------------------------
// Medidor de gasto en Firestore (Rol 5). SOLO SERVIDOR (Admin SDK: no pasa por
// firestore.rules). Esquema: docs/medidor-gasto.md.
//   usage/totals, usage/totals/days/{día}, usage/totals/hours/{hora}
//   rate_limits/{uid}   config/chat
// ---------------------------------------------------------------------------

const CONFIG_TTL_MS = 30_000 // apagar el chat tarda como máximo esto en hacer efecto
let configCache: { value: ChatConfig; at: number } | null = null

const spentOf = (s: DocumentSnapshot) => {
  const v = s.exists ? s.get("spentUsd") : 0
  return typeof v === "number" ? v : 0
}

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

  // Transacción: dos preguntas simultáneas del mismo usuario no pueden pasar
  // las dos el límite.
  async consumeRateLimit(uid: string, now: Date, limits: ChatLimits): Promise<boolean> {
    const ref = this.db.collection("rate_limits").doc(uid)
    return this.db.runTransaction(async (tx) => {
      const snap = await tx.get(ref)
      const prev = snap.exists ? parseRateLimitState(snap.data()) : null
      const { allowed, next } = decideRateLimit(prev, now, limits)
      if (allowed) tx.set(ref, { ...next, updatedAt: FieldValue.serverTimestamp() })
      return allowed
    })
  }

  async getSpend(now: Date): Promise<Spend> {
    const [totals, hour] = await this.db.getAll(
      this.db.doc("usage/totals"),
      this.db.doc(`usage/totals/hours/${hourKey(now)}`)
    )
    return { totalUsd: spentOf(totals), hourUsd: spentOf(hour) }
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
