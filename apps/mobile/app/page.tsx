"use client"

import { useEffect, useState } from "react"
import { collection, getDocs } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useAuth, useUser } from "@/lib/auth"
import { LocationChip } from "@/components/LocationChip"
import type { News } from "@respai/shared"

// Placeholder de Etapa 1: ya detrás del login (AuthGate en el layout), así que
// la lectura de `news` funciona con las reglas de Firestore. El feed real
// (ubicación, jerarquía visual) se construye encima de esto.
export default function Home() {
  const user = useUser()
  const { logOut } = useAuth()
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
    <main className="screen">
      <h1>RespAI News</h1>
      <LocationChip />
      <p className="muted">Sesión: {user.email}</p>
      <button className="btn" onClick={logOut}>
        Cerrar sesión
      </button>

      {error && <p className="error">Error leyendo Firestore: {error}</p>}
      {!news && !error && <p className="muted">Cargando…</p>}
      {news && news.length === 0 && <p>Conectado, pero la colección &quot;news&quot; está vacía todavía.</p>}
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
