"use client"

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react"
import Link from "next/link"
import { SourceTypeBadge, ValidationBadge } from "@/components/Badges"
import { useUser } from "@/lib/auth"
import {
  CHAT_LIMITS,
  EXAMPLE_QUESTIONS,
  NO_ANSWER_TEXT,
  type ChatAnswer,
  type ChatResponse,
  type Citation,
} from "@/lib/chat"
import { askChat } from "@/lib/chatClient"
import { useLocation } from "@/lib/profile"

// Pantalla del chat (Rol 2, paso 6). Va dentro de la hoja de ChatDock.tsx.
// Habla con POST /api/chat (diseño en docs/chat.md).
//
// Lo que se ve en cada respuesta viene del servidor, no se inventa aquí:
// - etiqueta "Respuesta generada por IA" solo si la redactó un modelo
//   (generatedBy: "model"); si no, "Modo de prueba · sin IA";
// - citas con el MISMO distintivo de validación que el feed y sus fuentes;
// - la nota "Lo que no está confirmado", armada por código en el servidor.

type Message =
  | { id: number; role: "user"; text: string }
  | { id: number; role: "assistant"; response: ChatResponse }

// Conversación TEMPORAL: vive en memoria mientras la app está abierta (así se
// puede abrir una noticia citada y volver sin perderla). Se borra al recargar
// o cerrar la app: no hay historial entre sesiones (enunciado).
let sessionMessages: Message[] = []
let nextId = 1

export function ChatPanel({ onClose }: { onClose: () => void }) {
  const user = useUser()
  const location = useLocation()
  const [messages, setMessagesState] = useState<Message[]>(() => sessionMessages)
  const [input, setInput] = useState("")
  const [pending, setPending] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  function setMessages(update: (prev: Message[]) => Message[]) {
    setMessagesState((prev) => {
      const next = update(prev)
      sessionMessages = next
      return next
    })
  }

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [messages, pending])

  async function send(question: string) {
    const q = question.trim()
    if (!q || pending) return
    setInput("")
    setPending(true)
    setMessages((prev) => [...prev, { id: nextId++, role: "user", text: q }])

    let response: ChatResponse
    try {
      response = await askChat(q, location, await user.getIdToken())
      // Token vencido: se renueva una vez y se reintenta.
      if (response.kind === "no_answer" && response.reason === "unauthenticated") {
        response = await askChat(q, location, await user.getIdToken(true))
      }
    } catch {
      // getIdToken puede fallar sin red: mensaje claro, nunca quedarse "buscando".
      response = { kind: "no_answer", reason: "error", text: NO_ANSWER_TEXT.error }
    }

    setMessages((prev) => [...prev, { id: nextId++, role: "assistant", response }])
    setPending(false)
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    void send(input)
  }

  function clear() {
    setMessages(() => [])
  }

  return (
    <>
      <div className="chat-body" aria-live="polite">
        {messages.length === 0 ? (
          <ChatIntro onPick={(q) => void send(q)} disabled={pending} />
        ) : (
          messages.map((m) =>
            m.role === "user" ? (
              <p key={m.id} className="chat-msg chat-msg-user">
                {m.text}
              </p>
            ) : (
              <AssistantMessage key={m.id} id={m.id} response={m.response} onNavigate={onClose} />
            )
          )
        )}

        {pending && (
          <p className="chat-msg chat-msg-bot chat-pending" aria-busy="true">
            <span className="spinner spinner-sm" aria-hidden="true" />
            Buscando en las noticias publicadas…
          </p>
        )}

        {messages.length > 0 && !pending && (
          <button type="button" className="text-link chat-clear" onClick={clear}>
            Borrar conversación
          </button>
        )}
        <div ref={endRef} />
      </div>

      <p className="chat-disclaimer">Responde solo con noticias publicadas en la app. Revisa siempre las fuentes.</p>
      <form className="chat-composer" onSubmit={onSubmit}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Pregunta sobre las noticias…"
          maxLength={CHAT_LIMITS.maxQuestionChars}
          enterKeyHint="send"
          aria-label="Escribe tu pregunta"
        />
        <button type="submit" className="chat-send" disabled={pending || !input.trim()} aria-label="Enviar">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path d="M5 12h13M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </form>
    </>
  )
}

function ChatIntro({ onPick, disabled }: { onPick: (q: string) => void; disabled: boolean }) {
  return (
    <div className="chat-ph">
      <div className="chat-ph-intro">
        <h2>Pregúntale a las noticias.</h2>
        <p className="muted">
          Responde solo con noticias publicadas, cita sus fuentes y te dice qué está confirmado y qué no. Si no puede
          confirmar algo, lo dice.
        </p>
      </div>
      <div className="chat-ph-examples" aria-label="Ejemplos de preguntas">
        <p className="chat-ph-label">Prueba con</p>
        <ul>
          {EXAMPLE_QUESTIONS.map((q) => (
            <li key={q}>
              <button type="button" className="chat-example" onClick={() => onPick(q)} disabled={disabled}>
                {q}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function AssistantMessage({ id, response, onNavigate }: { id: number; response: ChatResponse; onNavigate: () => void }) {
  if (response.kind === "no_answer") {
    return (
      <div className="chat-msg chat-msg-bot chat-msg-noanswer">
        <p>{response.text}</p>
        {(response.reason === "budget_exhausted" ||
          response.reason === "rate_limited" ||
          response.reason === "chat_disabled") && (
          <Link href="/feed" className="text-link" onClick={onNavigate}>
            Ir a la portada
          </Link>
        )}
      </div>
    )
  }
  return (
    <div className="chat-msg chat-msg-bot">
      <AnswerLabel answer={response} />
      <p className="chat-msg-text">{withRefs(response.text, id)}</p>

      {response.uncertainty && (
        <div className="chat-uncertainty" role="note">
          <strong>Lo que no está confirmado</strong>
          <p>{response.uncertainty}</p>
        </div>
      )}

      {response.citations.length > 0 && (
        <ol className="chat-cites" aria-label="Fuentes de esta respuesta">
          {response.citations.map((c, i) => (
            <CitationItem key={c.newsId} citation={c} n={i + 1} anchor={`cita-${id}-${i + 1}`} onNavigate={onNavigate} />
          ))}
        </ol>
      )}
    </div>
  )
}

function AnswerLabel({ answer }: { answer: ChatAnswer }) {
  if (answer.generatedBy === "model") {
    return (
      <span className="chat-label chat-label-ai">
        <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true">
          <path
            d="M12 3l1.9 4.8L18.7 9.7 13.9 11.6 12 16.4 10.1 11.6 5.3 9.7 10.1 7.8z M18.5 15l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9z"
            fill="currentColor"
          />
        </svg>
        Respuesta generada por IA
      </span>
    )
  }
  return <span className="chat-label chat-label-rules">Modo de prueba · sin IA</span>
}

// Resalta los "[1]" del texto y los enlaza a su cita de abajo.
function withRefs(text: string, msgId: number): ReactNode[] {
  return text.split(/(\[\d{1,2}\])/g).map((part, i) => {
    const m = part.match(/^\[(\d{1,2})\]$/)
    if (!m) return part
    return (
      <a key={i} className="chat-ref" href={`#cita-${msgId}-${m[1]}`} aria-label={`Fuente ${m[1]}`}>
        {m[1]}
      </a>
    )
  })
}

function CitationItem({
  citation: c,
  n,
  anchor,
  onNavigate,
}: {
  citation: Citation
  n: number
  anchor: string
  onNavigate: () => void
}) {
  return (
    <li id={anchor} className="chat-cite">
      <div className="chat-cite-head">
        <span className="chat-cite-num">{n}</span>
        <Link href={`/noticia/${c.newsId}`} className="chat-cite-title" onClick={onNavigate}>
          {c.title}
        </Link>
      </div>
      <div className="chat-cite-meta">
        <ValidationBadge status={c.validationStatus} size="sm" />
        {c.sources.map((s, i) => (
          <span key={i} className="chat-cite-source">
            {s.url ? (
              <a href={s.url} target="_blank" rel="noopener noreferrer">
                {s.name}
              </a>
            ) : (
              s.name
            )}{" "}
            <SourceTypeBadge type={s.type} />
          </span>
        ))}
      </div>
      {c.validationStatus !== "confirmed" && c.validationNote && <p className="chat-cite-note">{c.validationNote}</p>}
    </li>
  )
}
