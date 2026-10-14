"use client"

import { useEffect, useState } from "react"
import { ChatSwitch } from "@/components/costs/ChatSwitch"
import { MoneyPanel } from "@/components/costs/MoneyPanel"
import { PathsPanel, PeriodPanel } from "@/components/costs/UsagePanels"
import { dayKey, hourKey, parseConfig, parseCounters } from "@/lib/costs"
import { useDoc } from "@/lib/useDoc"

// Recalcula "ahora" cada minuto para que el día y la hora cambien solos.
function useNow(ms: number): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), ms)
    return () => clearInterval(t)
  }, [ms])
  return now
}

// Tablero de costos del chat (Rol 5). Solo números de uso, nunca contenido.
// Diseño: docs/medidor-gasto.md y docs/costos.md.
export default function CostsPage() {
  const now = useNow(60_000)
  const configState = useDoc("config/chat")
  const totalsState = useDoc("usage/totals")
  const day = useDoc(`usage/totals/days/${dayKey(now)}`)
  const hour = useDoc(`usage/totals/hours/${hourKey(now)}`)

  const config = parseConfig(configState.status === "ok" ? configState.data : null)
  const totals = parseCounters(totalsState.status === "ok" ? totalsState.data : null)

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1>Costos del chat</h1>
          <p className="muted">
            Solo números de uso: tokens, costo y cómo se resolvió cada pregunta. Nada del contenido de las
            conversaciones.
          </p>
        </div>
      </div>
      <ChatSwitch state={configState} config={config} spentUsd={totals.spentUsd} />
      <MoneyPanel configState={configState} totalsState={totalsState} config={config} totals={totals} />
      <PeriodPanel day={day} hour={hour} />
      <PathsPanel totalsState={totalsState} totals={totals} />
      <p className="muted small">
        Solo se cuenta el gasto que pasa por el chat de la app. Las pruebas hechas fuera de la app se anotan a mano
        en docs/costos.md y se concilian con la página Usage de la Consola de Anthropic.
      </p>
    </main>
  )
}
