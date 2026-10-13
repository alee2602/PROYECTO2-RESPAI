import type { News } from "@respai/shared"
// Rutas relativas con extensión: se resuelven también en `node --test`.
import { answerWithoutModel, buildCitations, uncertaintyNote, type ChatRequest, type ChatResponse, type Citation } from "./chat.ts"
import { buildPrompt, invalidCitations, type BuiltPrompt } from "./prompt.ts"
import { retrieveNews, type RetrievalResult } from "./retrieval.ts"

// ---------------------------------------------------------------------------
// Flujo completo del chat (Rol 2, paso 5): pregunta → respuesta. Puro: no lee
// Firestore ni llama a ningún modelo por su cuenta. Recibe las noticias ya
// leídas y, opcionalmente, una función `generate` que llama al modelo. Así se
// prueba de punta a punta sin red y sin gastar.
//
// Sin `generate` (todavía no hay créditos ni API key), responde en MODO DE
// PRUEBA: arma el texto con los resúmenes de las noticias recuperadas y lo
// dice claramente. Las citas y la nota de incertidumbre son las mismas que
// con el modelo, porque las arma el código.
// ---------------------------------------------------------------------------

export type ModelUsage = { inputTokens: number; outputTokens: number }
export type ModelOutput = { text: string; usage: ModelUsage }
export type Generate = (prompt: BuiltPrompt) => Promise<ModelOutput>

// Qué camino tomó la pregunta. Va a los logs del servidor (sin el texto de la
// pregunta) y sirve de evidencia para costos: cuántas preguntas se
// resolvieron sin modelo.
export type ChatTrace = {
  path: "no_model" | "simulated" | "model"
  reason?: string
  newsCount: number
  estimatedInputTokens?: number
  usage?: ModelUsage
  droppedCitations?: number[] // citas del modelo a noticias que no existen (se quitan del texto)
}

export const SIMULATED_PREFIX = "Modo de prueba (todavía sin IA): estas son las noticias publicadas que encontré."

function simulatedText(citations: Citation[], retrieval: RetrievalResult): string {
  const lines = retrieval.items.map(({ news: n }, i) => {
    const summary = n.summary.trim() || n.title
    return `[${i + 1}] ${n.title} (${citations[i].validationLabel}). ${summary}`
  })
  return [SIMULATED_PREFIX, ...lines].join("\n")
}

// Quita del texto del modelo las citas a noticias que no existen ("[7]" cuando
// hay 2). No se confía en que el modelo cite bien.
function dropInvalidCitations(text: string, invalid: number[]): string {
  let out = text
  for (const n of invalid) out = out.replace(new RegExp(`[ \\t]*\\[${n}\\]`, "g"), "")
  return out.trim()
}

export async function answerQuestion(
  req: ChatRequest,
  publishedNews: News[],
  today: string,
  generate: Generate | null
): Promise<{ response: ChatResponse; trace: ChatTrace }> {
  const retrieval = retrieveNews(req.question, publishedNews, req.location)

  // Paso 3: lo que no necesita modelo ($0).
  const noModel = answerWithoutModel(req.question, retrieval)
  if (noModel) {
    return { response: noModel, trace: { path: "no_model", reason: noModel.reason, newsCount: 0 } }
  }

  // Las citas y la incertidumbre las arma el código, con o sin modelo.
  const citations = buildCitations(retrieval)
  const uncertainty = uncertaintyNote(citations, retrieval.unmatchedTerms)
  const prompt = buildPrompt(req, retrieval, today)

  if (!generate) {
    return {
      response: { kind: "answer", text: simulatedText(citations, retrieval), citations, uncertainty, generatedBy: "rules" },
      trace: { path: "simulated", newsCount: citations.length, estimatedInputTokens: prompt.estimatedInputTokens },
    }
  }

  const output = await generate(prompt)
  const invalid = invalidCitations(output.text, citations.length)
  return {
    response: {
      kind: "answer",
      text: dropInvalidCitations(output.text, invalid),
      citations,
      uncertainty,
      generatedBy: "model",
    },
    trace: {
      path: "model",
      newsCount: citations.length,
      estimatedInputTokens: prompt.estimatedInputTokens,
      usage: output.usage,
      ...(invalid.length > 0 ? { droppedCitations: invalid } : {}),
    },
  }
}
