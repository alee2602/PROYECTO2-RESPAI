import { NO_ANSWER_TEXT, parseChatRequest, type ChatNoAnswer } from "@/lib/chat"
import { answerQuestion } from "@/lib/chatPipeline"
import { UnauthenticatedError, fetchPublishedNewsRest } from "@/lib/firestoreRest"
import { anthropicGenerate, parseThinkingMode } from "@/lib/anthropic"
import { meteredAnswer } from "@/lib/meteredChat"
import { getAdminApp, verifyUid } from "@/lib/serverAuth"
import { safeError } from "@/lib/safeLog"
import { parseBudgetEnv } from "@/lib/usage"
import { FirestoreUsageStore } from "@/lib/usageStoreFirestore"

// ---------------------------------------------------------------------------
// POST /api/chat — endpoint del chat (Rol 2, medidor de gasto: Rol 5). Corre
// en el servidor (Vercel).
//
// Recibe: { question, location } + header `Authorization: Bearer <ID token de Firebase>`.
// Devuelve: ChatResponse (lib/chat.ts). Diseño: docs/chat.md y docs/medidor-gasto.md.
//
// 1. Sin token → no responde (nadie de afuera puede usar el chat ni gastar).
// 2. Lee las noticias publicadas en el SERVIDOR, con el token del usuario
//    (lib/firestoreRest.ts): el cliente no puede inyectar noticias.
// 3. Con FIREBASE_SERVICE_ACCOUNT: verifica el token con el Admin SDK y pasa
//    por el medidor (lib/meteredChat.ts): interruptor, límite por usuario,
//    tope total con reserva para la demo y freno por hora. El modelo
//    (Haiku 5.5, lib/anthropic.ts) solo se llama si todo eso lo permite.
//    Sin esa variable NO hay medidor, así que nunca se llama al modelo
//    (modo de prueba, como antes).
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

  const today = new Date().toISOString().slice(0, 10)
  const loadNews = async () => (await fetchPublishedNewsRest(projectId, idToken)).items
  // Un registro por pregunta en los logs de Vercel. Sin el texto de la
  // pregunta, por privacidad: solo su largo.
  const log = (trace: object) =>
    console.log(JSON.stringify({ event: "chat", ...trace, questionChars: req.question.length, ms: Date.now() - started }))

  try {
    const app = getAdminApp()
    if (!app) {
      console.warn("[chat] Sin FIREBASE_SERVICE_ACCOUNT: medidor apagado, modo de prueba (no se llama al modelo)")
      const { response, trace } = await answerQuestion(req, await loadNews(), today, null)
      log(trace)
      return Response.json(response)
    }

    const uid = await verifyUid(app, idToken)
    if (!uid) return noAnswer(401, "unauthenticated")

    const budget = parseBudgetEnv(process.env)
    if (!budget) console.error("[chat] BUDGET_USD / RESERVE_USD faltan o son inválidos: no se llama al modelo")
    const apiKey = process.env.ANTHROPIC_API_KEY
    const generate = apiKey ? anthropicGenerate(apiKey, parseThinkingMode(process.env.CHAT_THINKING)) : null

    const { response, trace } = await meteredAnswer(uid, req, loadNews, {
      store: new FirestoreUsageStore(app),
      generate,
      budget,
      now: new Date(),
      today,
    })
    log(trace)
    return Response.json(response)
  } catch (e) {
    if (e instanceof UnauthenticatedError) return noAnswer(401, "unauthenticated")
    console.error("[chat] Error inesperado", safeError(e))
    return noAnswer(500, "error")
  }
}
