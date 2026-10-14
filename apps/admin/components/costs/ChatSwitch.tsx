"use client"

import { useState } from "react"
import { doc, serverTimestamp, setDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { chatState, docStatusMessage, type ChatConfig, type ChatStateKind } from "@/lib/costs"
import type { DocState } from "@/lib/useDoc"

const LABEL: Record<ChatStateKind, string> = {
  on: "Encendido",
  off_admin: "Apagado por un admin",
  off_reserve: "Apagado automáticamente: el saldo llegó a la reserva",
}

const RE_DISABLE_WARNING =
  "El saldo está bajo la reserva: si lo enciendes se volverá a apagar en la próxima pregunta. Baja la reserva primero."

// Interruptor del chat (RC-20). Encender es SIEMPRE manual; el endpoint solo
// puede apagar (cuando el saldo cruza la reserva).
export function ChatSwitch({ state, config, spentUsd }: { state: DocState; config: ChatConfig; spentUsd: number }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { state: kind, wouldReDisable } = chatState(config, spentUsd)
  const turningOn = kind !== "on"
  const unreadable = state.status === "loading" || state.status === "denied" || state.status === "error"
  const note = docStatusMessage(state, "Nunca se cambió: valores por defecto (encendido, reserva USD 10).")

  async function toggle() {
    const question = turningOn
      ? wouldReDisable
        ? `${RE_DISABLE_WARNING}\n\n¿Encender igual?`
        : "¿Encender el chat?"
      : "¿Apagar el chat? Nadie podrá hacer preguntas hasta que un admin lo vuelva a encender."
    if (!window.confirm(question)) return
    setBusy(true)
    setError(null)
    try {
      await setDoc(
        doc(db, "config/chat"),
        { enabled: turningOn, disabledBy: turningOn ? null : "admin", updatedAt: serverTimestamp() },
        { merge: true }
      )
    } catch (e) {
      setError(`No se pudo guardar (${(e as { code?: string }).code ?? "desconocido"}).`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className={`card chat-switch ${kind}`} aria-label="Estado del chat">
      <div className="chat-switch-head">
        <div>
          <span className="muted small">Estado del chat</span>
          <strong>{LABEL[kind]}</strong>
        </div>
        <button
          className={turningOn ? "btn btn-primary" : "btn btn-danger"}
          onClick={toggle}
          disabled={busy || unreadable}
        >
          {busy ? "Guardando…" : turningOn ? "Encender" : "Apagar"}
        </button>
      </div>
      {turningOn && wouldReDisable && <p className="warning small">{RE_DISABLE_WARNING}</p>}
      {note && <p className="muted small">{note}</p>}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  )
}
