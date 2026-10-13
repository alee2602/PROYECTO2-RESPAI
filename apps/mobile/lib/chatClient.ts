// Rutas relativas con extensión: se resuelven también en `node --test`.
import { NO_ANSWER_TEXT, type ChatResponse } from "./chat.ts"
import type { UserLocation } from "./locations.ts"

// Llamada del celular al endpoint del chat (POST /api/chat). Nunca lanza:
// cualquier falla (sin red, error del servidor, respuesta rara) se convierte
// en una respuesta `no_answer` con un mensaje claro para la persona.

function isChatResponse(d: unknown): d is ChatResponse {
  if (!d || typeof d !== "object") return false
  const r = d as { kind?: unknown; text?: unknown; citations?: unknown }
  if (typeof r.text !== "string") return false
  if (r.kind === "no_answer") return true
  return r.kind === "answer" && Array.isArray(r.citations)
}

export async function askChat(
  question: string,
  location: UserLocation,
  idToken: string,
  fetchImpl: typeof fetch = fetch
): Promise<ChatResponse> {
  try {
    const res = await fetchImpl("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ question, location }),
    })
    const data: unknown = await res.json().catch(() => null)
    if (isChatResponse(data)) return data
    const reason = res.status === 401 ? "unauthenticated" : "error"
    return { kind: "no_answer", reason, text: NO_ANSWER_TEXT[reason] }
  } catch {
    return { kind: "no_answer", reason: "error", text: NO_ANSWER_TEXT.error }
  }
}
