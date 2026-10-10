import type { ReactNode } from "react"
import type { News } from "@respai/shared"
import { IMAGE_ORIGIN_LABEL, SOURCE_TYPE_LABEL, VALIDATION_HINT, VALIDATION_LABEL } from "@/lib/labels"

// Distintivos visibles. Cada uno combina ícono + texto (no solo color), para
// que se entiendan también con daltonismo o en pantallas con poco contraste.

const VALIDATION_ICON: Record<News["validationStatus"], ReactNode> = {
  confirmed: <path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />,
  in_progress: (
    <>
      <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="2.4" />
      <path d="M12 7.5V12l3 2" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </>
  ),
  unverified: (
    <path
      d="M9.2 9.3a2.9 2.9 0 1 1 4.1 2.6c-.8.4-1.3 1-1.3 1.9v.6M12 17.6v.1"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
    />
  ),
}

export function ValidationBadge({ status, size = "md" }: { status: News["validationStatus"]; size?: "sm" | "md" }) {
  return (
    <span className={`badge badge-${status} badge-${size}`} title={VALIDATION_HINT[status]}>
      <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
        {VALIDATION_ICON[status]}
      </svg>
      {VALIDATION_LABEL[status]}
    </span>
  )
}

export function SourceTypeBadge({ type }: { type: News["sources"][number]["type"] }) {
  return <span className={`source-type source-type-${type}`}>{SOURCE_TYPE_LABEL[type]}</span>
}

// Etiqueta que va ENCIMA de la imagen cuando fue generada por IA. Obligatoria
// en tarjeta y lector (CLAUDE.md, sección 3: "Imágenes").
export function AiImageLabel() {
  return (
    <span className="ai-image-label">
      <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true">
        <path
          d="M12 3l1.9 4.8L18.7 9.7 13.9 11.6 12 16.4 10.1 11.6 5.3 9.7 10.1 7.8z M18.5 15l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9z"
          fill="currentColor"
        />
      </svg>
      {IMAGE_ORIGIN_LABEL.ai_generated}
    </span>
  )
}

// Línea corta de procedencia para tarjetas: "Fuente: X · Original (+1)".
export function SourceLine({ sources }: { sources: News["sources"] }) {
  const [first, ...rest] = sources
  if (!first) return null
  return (
    <span className="source-line">
      <span className="source-line-name">{first.name}</span>
      <SourceTypeBadge type={first.type} />
      {rest.length > 0 && <span className="source-line-more">+{rest.length}</span>}
    </span>
  )
}
