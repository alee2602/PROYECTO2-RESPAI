import type { ModelUsage } from "./chatPipeline.ts"
import { PROMPT_LIMITS } from "./prompt.ts"

// ---------------------------------------------------------------------------
// Precios del modelo del chat (Rol 5). Fuente: precios oficiales de Anthropic
// para prompts de hasta 100.000 tokens. Si cambia el modelo, cambiar esto y
// anotarlo en docs/costos.md. Módulo puro.
// ---------------------------------------------------------------------------

export const CHAT_MODEL = "claude-haiku-5-5"

export const PRICE_USD_PER_MTOK = { input: 0.1, output: 0.5 } as const

// Tope de entrada que fija prompt.test.ts ("contexto corto", docs/chat.md paso 4).
export const WORST_CASE_INPUT_TOKENS = 2500

export function costUsd(usage: ModelUsage): number {
  return (
    (usage.inputTokens * PRICE_USD_PER_MTOK.input + usage.outputTokens * PRICE_USD_PER_MTOK.output) / 1_000_000
  )
}

// Lo máximo que puede costar UNA llamada: max_tokens incluye el pensamiento,
// así que la salida nunca pasa de PROMPT_LIMITS.maxOutputTokens.
export const WORST_CASE_COST_USD = costUsd({
  inputTokens: WORST_CASE_INPUT_TOKENS,
  outputTokens: PROMPT_LIMITS.maxOutputTokens,
})
