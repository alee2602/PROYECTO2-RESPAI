import type { CSSProperties } from "react"
import type { News } from "@respai/shared"
import { VALIDATION_HINT, VALIDATION_LABEL } from "@/lib/labels"

// Panel de verificación del lector: muestra en qué punto del proceso está la
// noticia (No verificada → En desarrollo → Confirmada), la nota del equipo
// editorial y quién decide el estado. El estado lo pone una persona en el
// portal; este componente solo lo muestra.

const STEPS: News["validationStatus"][] = ["unverified", "in_progress", "confirmed"]

export function VerificationPanel({ status, note }: { status: News["validationStatus"]; note?: string }) {
  const current = STEPS.indexOf(status)

  return (
    <section className={`verify verify-${status}`} aria-labelledby="h-verify">
      <h2 id="h-verify" className="verify-eyebrow">
        Estado de verificación
      </h2>

      <ol className="verify-track" style={{ "--progress": current / (STEPS.length - 1) } as CSSProperties}>
        {STEPS.map((s, i) => (
          <li
            key={s}
            className={i < current ? "is-past" : i === current ? "is-current" : "is-next"}
            aria-current={i === current ? "step" : undefined}
          >
            <span className="verify-dot" aria-hidden="true" />
            <span className="verify-step">{VALIDATION_LABEL[s]}</span>
          </li>
        ))}
      </ol>

      <p className="verify-status">
        <strong>{VALIDATION_LABEL[status]}.</strong> {VALIDATION_HINT[status]}
      </p>

      {note && (
        <blockquote className="verify-note">
          <p>{note}</p>
          <cite>Equipo editorial</cite>
        </blockquote>
      )}

      <p className="verify-who">
        <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
          <circle cx="12" cy="8" r="3.6" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M4.5 20c1.2-3.6 4-5.4 7.5-5.4s6.3 1.8 7.5 5.4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        Lo decide una persona del equipo, no la IA.
      </p>
    </section>
  )
}
