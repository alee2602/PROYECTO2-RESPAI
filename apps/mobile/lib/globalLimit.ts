import { safeError } from "./safeLog.ts"
import { decideReserve, type ChatConfig } from "./usage.ts"
import type { UsageStore } from "./usageStore.ts"

// ---------------------------------------------------------------------------
// Límite global del chat (Rol 5). SOLO SERVIDOR. Es la ÚNICA pieza que conoce
// el saldo y la reserva: el resto del chat solo recibe "puede" o "no puede".
//   1. ¿Interruptor apagado? → no puede (y por qué: admin o reserva).
//   2. ¿El peor caso de una llamada cruzaría la reserva? → apaga el
//      interruptor (idempotente) y no puede. Encenderlo es manual (portal).
// Falla cerrada: si Firestore no responde, no puede.
// ---------------------------------------------------------------------------

export type GlobalDecision = { allowed: true } | { allowed: false; why: "admin" | "reserve" | "store" }

export async function checkGlobalLimit(store: UsageStore): Promise<GlobalDecision> {
  let config: ChatConfig
  try {
    config = await store.getConfig()
  } catch (e) {
    console.error("[usage] No se pudo leer config/chat; no se llama al modelo", safeError(e))
    return { allowed: false, why: "store" }
  }
  if (!config.enabled) return { allowed: false, why: config.disabledBy === "reserve" ? "reserve" : "admin" }

  let spentUsd: number
  try {
    spentUsd = await store.getTotalSpend()
  } catch (e) {
    console.error("[usage] No se pudo leer el gasto; no se llama al modelo", safeError(e))
    return { allowed: false, why: "store" }
  }

  if (!decideReserve(spentUsd, config.reserveUsd)) {
    try {
      await store.disableChat("reserve")
    } catch (e) {
      // Igual no se llama al modelo: la próxima pregunta lo vuelve a intentar.
      console.error("[usage] No se pudo apagar el chat por la reserva", safeError(e))
    }
    return { allowed: false, why: "reserve" }
  }
  return { allowed: true }
}
