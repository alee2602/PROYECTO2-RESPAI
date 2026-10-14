import type { News } from "@respai/shared"
import { NO_ANSWER_TEXT, type ChatRequest, type ChatResponse } from "./chat.ts"
import { answerQuestion, type Generate, type ModelUsage } from "./chatPipeline.ts"
import { costUsd } from "./pricing.ts"
import { PaidModelError, decideBudget, type BudgetSettings, type ChatConfig, type UsagePath } from "./usage.ts"
import { safeError } from "./safeLog.ts"
import type { UsageStore } from "./usageStore.ts"

// ---------------------------------------------------------------------------
// El chat CON medidor de gasto (Rol 5). Envuelve a answerQuestion (Rol 2) sin
// modificarla. Orden (docs/medidor-gasto.md):
//   interruptor → límite del usuario → noticias → (respuesta sin modelo)
//   → tope total y freno por hora → modelo → registrar uso.
// Regla: ante la duda NO se llama al modelo (falla cerrada).
// Puro respecto a la red: Firestore y el modelo llegan como dependencias.
// ---------------------------------------------------------------------------

export type MeteredTrace = {
  path: UsagePath
  reason?: string
  newsCount: number
  usage?: ModelUsage
  costUsd?: number
  recordFailed?: true
}

export type MeteredDeps = {
  store: UsageStore
  generate: Generate | null // null: sin API key → modo de prueba
  budget: BudgetSettings | null // null: BUDGET_USD / RESERVE_USD inválidos → nunca se llama al modelo
  now: Date
  today: string // YYYY-MM-DD, para el prompt
}

class BudgetBlocked extends Error {}

type EndpointReason = "chat_disabled" | "rate_limited" | "budget_exhausted" | "error"

function noAnswer(reason: EndpointReason): ChatResponse {
  return { kind: "no_answer", reason, text: NO_ANSWER_TEXT[reason] }
}

export async function meteredAnswer(
  uid: string,
  req: ChatRequest,
  loadNews: () => Promise<News[]>,
  deps: MeteredDeps
): Promise<{ response: ChatResponse; trace: MeteredTrace }> {
  const { store, now } = deps

  // Toda pregunta suma a los contadores con su camino. Si registrar falla, la
  // respuesta sale igual (si hubo modelo, ya se pagó) y queda en el log.
  const finish = async (response: ChatResponse, trace: MeteredTrace) => {
    try {
      await store.record({ path: trace.path, ...(trace.usage ? { usage: trace.usage } : {}) }, now)
      return { response, trace }
    } catch (e) {
      console.error("[usage] No se pudo registrar el uso", safeError(e))
      return { response, trace: { ...trace, recordFailed: true as const } }
    }
  }
  const storeDown = (e: unknown) => {
    console.error("[usage] Firestore no respondió; no se llama al modelo", safeError(e))
    return finish(noAnswer("error"), { path: "error", reason: "store", newsCount: 0 })
  }

  // 1. Interruptor.
  let config: ChatConfig
  try {
    config = await store.getConfig()
  } catch (e) {
    return storeDown(e)
  }
  if (!config.enabled) return finish(noAnswer("chat_disabled"), { path: "disabled", newsCount: 0 })

  // 2. Límite del usuario.
  let allowed: boolean
  try {
    allowed = await store.consumeRateLimit(uid, now, config.limits)
  } catch (e) {
    return storeDown(e)
  }
  if (!allowed) return finish(noAnswer("rate_limited"), { path: "rate_limited", newsCount: 0 })

  // 3. Noticias. Sus errores (p. ej. sesión vencida) los maneja el endpoint.
  const news = await loadNews()

  // 4. El modelo solo se llama si hay key, presupuesto válido y el tope lo
  // permite. El chequeo va DENTRO de generate: answerQuestion solo lo invoca
  // cuando de verdad hace falta redactar (las respuestas sin modelo no gastan
  // ni una lectura del gasto).
  const { generate: modelGenerate, budget } = deps
  const generate: Generate | null =
    modelGenerate && budget
      ? async (prompt) => {
          const decision = decideBudget(await store.getSpend(now), budget, config.limits)
          if (!decision.allowed) throw new BudgetBlocked(decision.why)
          return modelGenerate(prompt)
        }
      : null

  try {
    const { response, trace } = await answerQuestion(req, news, deps.today, generate)
    return finish(response, {
      path: trace.path,
      ...(trace.reason ? { reason: trace.reason } : {}),
      newsCount: trace.newsCount,
      ...(trace.usage ? { usage: trace.usage, costUsd: costUsd(trace.usage) } : {}),
    })
  } catch (e) {
    if (e instanceof BudgetBlocked) {
      return finish(noAnswer("budget_exhausted"), { path: "budget_blocked", reason: e.message, newsCount: 0 })
    }
    if (e instanceof PaidModelError) {
      console.error("[chat] El modelo cobró pero no dio una respuesta usable:", e.message)
      return finish(noAnswer("error"), {
        path: "error", reason: e.message, newsCount: 0, usage: e.usage, costUsd: costUsd(e.usage),
      })
    }
    console.error("[chat] Error al responder", safeError(e))
    return finish(noAnswer("error"), { path: "error", newsCount: 0 })
  }
}
