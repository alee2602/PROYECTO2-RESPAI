"use client"

import { useState } from "react"
import Link from "next/link"
import type { News } from "@respai/shared"
import { SCOPE_LABEL, STATUS_LABEL } from "@/lib/labels"

// Fila de la lista: lo mínimo para encontrar una noticia y ver su estado.
export type NewsRow = {
  id: string
  title: string
  validationStatus: News["validationStatus"] | null // null = dato inválido en Firestore
  scope: News["scope"] | null
  place: string // "Petén, Guatemala", "México" o ""
  published: boolean
  date: Date | null // publicación, o creación si es borrador
  sources: number
  hasImage: boolean
}

type Filter = "all" | "published" | "drafts"

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: "published", label: "Publicadas" },
  { value: "drafts", label: "Borradores" },
]

const dateFormat = new Intl.DateTimeFormat("es-GT", { dateStyle: "medium", timeStyle: "short" })

export function NewsList({ rows }: { rows: NewsRow[] }) {
  const [filter, setFilter] = useState<Filter>("all")
  const visible = rows.filter((r) => filter === "all" || r.published === (filter === "published"))

  return (
    <section className="news-list" aria-label="Noticias">
      <div className="tabs" role="tablist">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            role="tab"
            aria-selected={filter === f.value}
            className={`tab ${filter === f.value ? "selected" : ""}`}
            onClick={() => setFilter(f.value)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {visible.length === 0 && <p className="muted">No hay noticias en esta vista.</p>}

      <ul>
        {visible.map((r) => (
          <li key={r.id}>
            <Link href={`/editar/${r.id}`} className="news-row">
              <div className="news-row-main">
                <strong>{r.title || "(sin título)"}</strong>
                <span className="muted small">
                  {[r.scope && SCOPE_LABEL[r.scope], r.place].filter(Boolean).join(" · ")}
                  {r.date && ` · ${r.published ? "publicada" : "creada"} ${dateFormat.format(r.date)}`}
                </span>
              </div>
              <div className="news-row-tags">
                {r.validationStatus ? (
                  <span className={`chip ${r.validationStatus}`}>{STATUS_LABEL[r.validationStatus]}</span>
                ) : (
                  <span className="chip error">Sin estado válido</span>
                )}
                {!r.published && <span className="chip">Borrador</span>}
                {r.sources === 0 && <span className="chip error">Sin fuentes</span>}
                {!r.hasImage && <span className="chip">Sin imagen</span>}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
