import { NO_ANSWER_TEXT, parseChatRequest, type ChatNoAnswer } from "@/lib/chat"
import { answerQuestion, type Generate } from "@/lib/chatPipeline"
import { UnauthenticatedError, fetchPublishedNewsRest } from "@/lib/firestoreRest"

// ---------------------------------------------------------------------------
// POST /api/chat — endpoint del chat (Rol 2). Corre en el servidor (Vercel).
//
// Recibe: { question, location } + header `Authorization: Bearer <ID token de Firebase>`.
// Devuelve: ChatResponse (lib/chat.ts). Diseño completo: docs/chat.md.
//
// 1. Sin token → no responde (nadie de afuera puede usar el chat ni gastar).
// 2. Lee las noticias publicadas en el SERVIDOR, con el token del usuario
//    (lib/firestoreRest.ts): el cliente no puede inyectar noticias.
// 3. Recupera sin modelo, responde sin modelo cuando no hace falta, y si hace
//    falta redactar, usa el modelo (lib/chatPipeline.ts).
//
// MODELO: todavía no conectado (sin créditos ni API key). `generate` es null y
// el chat responde en "modo de prueba", diciéndolo claramente. Para conectarlo:
// crear la función con el SDK oficial usando process.env.ANTHROPIC_API_KEY
// (solo servidor, nunca NEXT_PUBLIC_) y, ANTES de llamarla, revisar el tope de
// gasto (medidor del Rol 5): si se alcanzó, responder "budget_exhausted".
// ---------------------------------------------------------------------------

function noAnswer(status: number, reason: "unauthenticated" | "error"): Response {
  const body: ChatNoAnswer = { kind: "no_answer", reason, text: NO_ANSWER_TEXT[reason] }
  return Response.json(body, { status })
}

export async function POST(request: Request): Promise<Response> {
  const started = Date.now()

  const auth = request.headers.get("authorization") ?? ""
  const idToken = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length).trim() : ""
  if (!idToken) return noAnswer(401, "unauthenticated")

  let body: unknown = null
  try {
    body = await request.json()
  } catch {
    // cuerpo vacío o no-JSON: lo rechaza parseChatRequest
  }
  const req = parseChatRequest(body)
  if (!req) return noAnswer(400, "error")

  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  if (!projectId) {
    console.error("[chat] Falta NEXT_PUBLIC_FIREBASE_PROJECT_ID en el servidor")
    return noAnswer(500, "error")
  }

  try {
    const { items } = await fetchPublishedNewsRest(projectId, idToken)

    const generate: Generate | null = null // ver comentario de arriba: se conecta con el modelo elegido

    const today = new Date().toISOString().slice(0, 10)
    const { response, trace } = await answerQuestion(req, items, today, generate)

    // Un registro por pregunta en los logs de Vercel (evidencia de costos y de
    // cuántas preguntas se resolvieron sin modelo). Sin el texto de la
    // pregunta, por privacidad: solo su largo.
    console.log(
      JSON.stringify({ event: "chat", ...trace, questionChars: req.question.length, ms: Date.now() - started })
    )
    return Response.json(response)
  } catch (e) {
    if (e instanceof UnauthenticatedError) return noAnswer(401, "unauthenticated")
    console.error("[chat] Error inesperado", e)
    return noAnswer(500, "error")
  }
}
