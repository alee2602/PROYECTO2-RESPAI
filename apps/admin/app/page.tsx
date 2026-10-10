"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { collection, getDocs } from "firebase/firestore"
import type { News } from "@respai/shared"
import { db } from "@/lib/firebase"

type Stats = {
  total: number
  published: number
  byStatus: Record<News["validationStatus"], number>
}

// Inicio del portal: resumen de lo que hay en `news` y acceso a crear una
// noticia. La lista para editar llega en el siguiente PR del Rol 3.
export default function Home() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getDocs(collection(db, "news"))
      .then((snap) => {
        const s: Stats = { total: 0, published: 0, byStatus: { confirmed: 0, in_progress: 0, unverified: 0 } }
        snap.forEach((doc) => {
          const n = doc.data() as Partial<News>
          s.total++
          if (n.publishedAt) s.published++
          if (n.validationStatus && n.validationStatus in s.byStatus) s.byStatus[n.validationStatus]++
        })
        setStats(s)
      })
      .catch((e) => setError(e.code ?? String(e)))
  }, [])

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
    </main>
  )
}
