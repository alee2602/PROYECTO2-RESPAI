"use client"

import { useState, type FormEvent } from "react"
import { doc, serverTimestamp, setDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import {
  barSegments,
  docStatusMessage,
  formatUsd,
  moneySummary,
  validateReserveInput,
  type ChatConfig,
  type Counters,
} from "@/lib/costs"
import type { DocState } from "@/lib/useDoc"

// Dinero: presupuesto fijo (informativo), gastado, saldo, reserva editable
// y lo disponible antes de la reserva.
export function MoneyPanel({
  configState,
  totalsState,
  config,
  totals,
}: {
  configState: DocState
  totalsState: DocState
  config: ChatConfig
  totals: Counters
}) {
  const [draft, setDraft] = useState<string | null>(null) // null = mostrando el valor guardado
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const m = moneySummary(totals.spentUsd, config.reserveUsd)
  const bar = barSegments(m)
  const totalsNote = docStatusMessage(totalsState, "Todavía no hay preguntas registradas.")
  const configUnreadable =
    configState.status === "loading" || configState.status === "denied" || configState.status === "error"

  async function saveReserve(e: FormEvent) {
    e.preventDefault()
    const v = validateReserveInput(draft ?? String(config.reserveUsd))
    if (!v.ok) {
      setError(v.message)
      return
    }
    setBusy(true)
    setError(null)
    try {
      await setDoc(doc(db, "config/chat"), { reserveUsd: v.value, updatedAt: serverTimestamp() }, { merge: true })
      setDraft(null)
    } catch (err) {
      setError(`No se pudo guardar (${(err as { code?: string }).code ?? "desconocido"}).`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card" aria-label="Dinero">
      <h2>Dinero</h2>
      <div className="stats">
        <div className="stat">
          <strong>{formatUsd(m.budget)}</strong>
          <span className="muted small">presupuesto (fijo)</span>
        </div>
        <div className="stat">
          <strong>{formatUsd(m.spent)}</strong>
          <span className="muted small">gastado</span>
        </div>
        <div className="stat">
          <strong>{formatUsd(m.balance)}</strong>
          <span className="muted small">saldo</span>
        </div>
        <div className="stat">
          <strong>{formatUsd(m.reserve)}</strong>
          <span className="muted small">reserva</span>
        </div>
        <div className="stat">
          <strong>{formatUsd(m.available)}</strong>
          <span className="muted small">disponible antes de la reserva</span>
        </div>
      </div>

      <div
        className="money-bar"
        role="img"
        aria-label={`Gastado ${formatUsd(m.spent)}, disponible ${formatUsd(m.available)}, reserva ${formatUsd(m.reserve)}, de ${formatUsd(m.budget)}`}
      >
        {/* flex-grow proporcional: los 2 px de separación no desbordan la barra */}
        {bar.spentPct > 0 && (
          <span className="money-bar-spent" style={{ flexGrow: bar.spentPct }} title={`Gastado: ${formatUsd(m.spent)}`} />
        )}
        {bar.availablePct > 0 && (
          <span
            className="money-bar-available"
            style={{ flexGrow: bar.availablePct }}
            title={`Disponible: ${formatUsd(m.available)}`}
          />
        )}
        {bar.reservePct > 0 && (
          <span className="money-bar-reserve" style={{ flexGrow: bar.reservePct }} title={`Reserva: ${formatUsd(m.reserve)}`} />
        )}
      </div>
      <p className="money-legend small muted">
        <span className="dot money-bar-spent" /> Gastado <span className="dot money-bar-available" /> Disponible{" "}
        <span className="dot money-bar-reserve" /> Reserva
      </p>

      <form className="reserve-form" onSubmit={saveReserve}>
        <label className="field">
          <span>Reserva (USD, de 0 a 20)</span>
          <input
            inputMode="decimal"
            value={draft ?? String(config.reserveUsd)}
            onChange={(e) => setDraft(e.target.value)}
            disabled={busy || configUnreadable}
          />
        </label>
        <button className="btn" type="submit" disabled={busy || configUnreadable || draft === null}>
          {busy ? "Guardando…" : "Guardar"}
        </button>
      </form>
      <p className="muted small">
        Si el saldo menos el costo máximo de una pregunta queda por debajo de la reserva, el chat se apaga solo.
        Para la demo se puede bajar la reserva a 0.
      </p>
      {totalsNote && <p className="muted small">{totalsNote}</p>}
      {totals.invalid && <p className="warning small">Hay un dato inválido en los totales: se tomó como 0.</p>}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  )
}
