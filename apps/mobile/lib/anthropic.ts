import Anthropic from "@anthropic-ai/sdk"
import type { Generate } from "./chatPipeline.ts"
import { CHAT_MODEL } from "./pricing.ts"
import type { BuiltPrompt } from "./prompt.ts"
import { PaidModelError } from "./usage.ts"

// ---------------------------------------------------------------------------
// La única llamada a un modelo en todo el producto (Rol 5 + Rol 2): Haiku 5.5
// redacta la respuesta del chat. SOLO SERVIDOR: usa ANTHROPIC_API_KEY.
// Una llamada por pregunta, sin herramientas (RC-04, docs/reduccion-costos.md).
// ---------------------------------------------------------------------------

// Pensamiento al mínimo (RC-08). "disabled" por defecto; "low" queda para
// compararlo en el banco de pruebas. Variable de entorno: CHAT_THINKING.
export type ThinkingMode = "disabled" | "low"

export function parseThinkingMode(v: string | undefined): ThinkingMode {
  return v === "low" ? "low" : "disabled"
}

// Lo mínimo que usamos de la respuesta de la API (permite probar sin red).
export type ModelMessage = {
  content: Array<{ type: string; text?: string }>
  stop_reason: string | null
  usage: { input_tokens: number; output_tokens: number }
}
export type CreateMessage = (params: Anthropic.MessageCreateParamsNonStreaming) => Promise<ModelMessage>

export function requestParams(prompt: BuiltPrompt, mode: ThinkingMode): Anthropic.MessageCreateParamsNonStreaming {
  return {
    model: CHAT_MODEL,
    max_tokens: prompt.maxOutputTokens, // incluye el pensamiento: tope duro de salida
    system: prompt.system,
    messages: [{ role: "user", content: prompt.user }],
    ...(mode === "disabled" ? { thinking: { type: "disabled" as const } } : { output_config: { effort: "low" as const } }),
  }
}

export function createGenerate(create: CreateMessage, mode: ThinkingMode): Generate {
  return async (prompt) => {
    const msg = await create(requestParams(prompt, mode))
    const usage = { inputTokens: msg.usage.input_tokens, outputTokens: msg.usage.output_tokens }
    if (msg.stop_reason === "refusal") throw new PaidModelError("refusal", usage)
    const text = msg.content
      .filter((b) => b.type === "text" && typeof b.text === "string")
      .map((b) => b.text)
      .join("")
      .trim()
    if (!text) throw new PaidModelError(`sin texto (stop_reason: ${msg.stop_reason})`, usage)
    return { text, usage }
  }
}

export function anthropicGenerate(apiKey: string, mode: ThinkingMode): Generate {
  // Un solo reintento y 20 s de espera: más reintentos = más gasto posible.
  const client = new Anthropic({ apiKey, maxRetries: 1, timeout: 20_000 })
  return createGenerate((params) => client.messages.create(params), mode)
}
