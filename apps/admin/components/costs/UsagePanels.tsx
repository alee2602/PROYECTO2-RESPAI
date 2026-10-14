"use client"

import { KNOWN_PATHS, docStatusMessage, formatUsd, parseCounters, savingsEstimate, type Counters } from "@/lib/costs"
import type { DocState } from "@/lib/useDoc"

const countersOf = (s: DocState) => parseCounters(s.status === "ok" ? s.data : null)

function PeriodStat({ label, state }: { label: string; state: DocState }) {
  const c = countersOf(state)
  const note = docStatusMessage(state, "Sin preguntas todavía.")
  return (
    <div className="stat">
      <strong>{formatUsd(c.spentUsd)}</strong>
      <span className="muted small">
        {label}: {c.totalQuestions} {c.totalQuestions === 1 ? "pregunta" : "preguntas"}
      </span>
      {note && <span className="muted small"> · {note}</span>}
      {c.invalid && <span className="warning small"> · dato inválido</span>}
    </div>
  )
}

// Gasto y preguntas de hoy y de la hora actual (UTC).
export function PeriodPanel({ day, hour }: { day: DocState; hour: DocState }) {
  return (
    <section className="card" aria-label="Hoy y esta hora">
      <h2>Hoy y esta hora (UTC)</h2>
      <div className="stats">
        <PeriodStat label="Hoy" state={day} />
        <PeriodStat label="Esta hora" state={hour} />
      </div>
    </section>
  )
}

// Cómo se resolvieron las preguntas, el ahorro estimado y los tokens.
export function PathsPanel({ totalsState, totals }: { totalsState: DocState; totals: Counters }) {
  const savings = savingsEstimate(totals)
  const note = docStatusMessage(totalsState, "Todavía no hay preguntas registradas.")
  return (
    <section className="card" aria-label="Cómo se resolvieron las preguntas">
      <h2>Cómo se resolvieron las preguntas</h2>
      {note && <p className="muted small">{note}</p>}
      <table className="paths-table">
        <tbody>
          {KNOWN_PATHS.map(([key, label]) => (
            <tr key={key}>
              <th scope="row">{label}</th>
              <td>{totals.questions[key]}</td>
            </tr>
          ))}
          <tr className="paths-total">
            <th scope="row">Total</th>
            <td>{totals.totalQuestions}</td>
          </tr>
        </tbody>
      </table>
      <p className="small">
        <strong>Ahorro estimado: </strong>
        {savings
          ? `${formatUsd(savings.savedUsd)} (${savings.avoidedQuestions} preguntas sin modelo × ${formatUsd(savings.avgModelCostUsd)} de costo promedio real)`
          : "sin datos para estimar (todavía no hay preguntas con modelo)."}
      </p>
      <p className="small muted">
        Tokens: {totals.inputTokens.toLocaleString("es")} de entrada · {totals.outputTokens.toLocaleString("es")} de
        salida
        {savings ? ` · costo promedio por pregunta con modelo ${formatUsd(savings.avgModelCostUsd)}` : ""}
      </p>
      {totals.invalid && <p className="warning small">Hay un dato inválido en los totales: se tomó como 0.</p>}
    </section>
  )
}
