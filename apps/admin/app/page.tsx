"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { collection, getDocs, Timestamp } from "firebase/firestore"
import type { News } from "@respai/shared"
import { db } from "@/lib/firebase"
import { NewsList, type NewsRow } from "@/components/NewsList"

type Stats = {
  total: number
  published: number
  byStatus: Record<News["validationStatus"], number>
}

const STATUSES = ["confirmed", "in_progress", "unverified"] as const
const SCOPES = ["local", "national", "international"] as const

// Las semilla guardan fechas como Timestamp; se acepta también texto ISO.
function toDate(v: unknown): Date | null {
  if (v instanceof Timestamp) return v.toDate()
  if (typeof v === "string" && v) return new Date(v)
  return null
}

function toRow(id: string, d: Record<string, unknown>): NewsRow {
  const status = STATUSES.find((s) => s === d.validationStatus) ?? null
  const scope = SCOPES.find((s) => s === d.scope) ?? null
  const place = [d.region, d.country].filter((v) => typeof v === "string" && v).join(", ")
  return {
    id,
    title: typeof d.title === "string" ? d.title : "",
    validationStatus: status,
    scope,
    place,
    published: !!d.publishedAt,
    date: toDate(d.publishedAt) ?? toDate(d.createdAt),
    sources: Array.isArray(d.sources) ? d.sources.length : 0,
    hasImage: !!(d.image && typeof d.image === "object" && "url" in d.image),
  }
}

// Inicio del portal: resumen y lista de todo lo que hay en `news` (también
// borradores), con acceso a crear y editar.
export default function Home() {
  const [rows, setRows] = useState<NewsRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getDocs(collection(db, "news"))
      .then((snap) => {
        const list = snap.docs.map((doc) => toRow(doc.id, doc.data()))
        list.sort((a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0))
        setRows(list)
      })
      .catch((e) => setError(e.code ?? String(e)))
  }, [])

  const stats: Stats | null = rows && {
    total: rows.length,
    published: rows.filter((r) => r.published).length,
    byStatus: {
      confirmed: rows.filter((r) => r.validationStatus === "confirmed").length,
      in_progress: rows.filter((r) => r.validationStatus === "in_progress").length,
      unverified: rows.filter((r) => r.validationStatus === "unverified").length,
    },
  }

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1>Noticias</h1>
          <p className="muted">
            Publicar y decidir el estado de validación es criterio humano: la IA puede asistir, nunca decidir.
          </p>
        </div>
        <Link href="/nueva" className="btn btn-primary">
          + Nueva noticia
        </Link>
      </div>

      {error && (
        <p className="error" role="alert">
          No se pudo leer Firestore ({error}).
        </p>
      )}
      {!stats && !error && <p className="muted">Cargando…</p>}

      {stats && (
        <section className="stats" aria-label="Resumen">
          <div className="stat">
            <strong>{stats.total}</strong>
            <span className="muted small">en total</span>
          </div>
          <div className="stat">
            <strong>{stats.published}</strong>
            <span className="muted small">publicadas</span>
          </div>
          <div className="stat confirmed">
            <strong>{stats.byStatus.confirmed}</strong>
            <span className="muted small">confirmadas</span>
          </div>
          <div className="stat in_progress">
            <strong>{stats.byStatus.in_progress}</strong>
            <span className="muted small">en desarrollo</span>
          </div>
          <div className="stat unverified">
            <strong>{stats.byStatus.unverified}</strong>
            <span className="muted small">no verificadas</span>
          </div>
        </section>
      )}

      {rows && <NewsList rows={rows} />}
    </main>
  )
}
