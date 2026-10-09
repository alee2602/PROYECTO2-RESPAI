"use client"

import { useEffect, useState } from "react"
import { collection, getDocs } from "firebase/firestore"
import { db } from "@/lib/firebase"
import type { News } from "@respai/shared"

// Placeholder de Etapa 0/1: confirma que Next.js -> Firebase -> Firestore
// funciona de punta a punta. El feed real (jerarquía visual, selector de
// ubicación, login) lo construye Rol 1 encima de esto.
export default function Home() {
  const [news, setNews] = useState<News[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getDocs(collection(db, "news"))
      .then((snap) => {
        setNews(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as News))
      })
      .catch((e) => setError(e.code ?? String(e)))
  }, [])

  return (
    <main style={{ padding: 24, fontFamily: "sans-serif" }}>
      <h1>RespAI News — placeholder</h1>
      <p>Esto confirma la conexión Next.js → Firebase → Firestore. No es el feed final.</p>

      {error && <p style={{ color: "crimson" }}>Error leyendo Firestore: {error}</p>}
      {!news && !error && <p>Cargando...</p>}
      {news && news.length === 0 && <p>Conectado, pero la colección "news" está vacía todavía.</p>}
      {news && news.length > 0 && (
        <ul>
          {news.map((n) => (
            <li key={n.id}>{n.title ?? "(sin título)"}</li>
          ))}
        </ul>
      )}
    </main>
  )
}
