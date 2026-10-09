"use client"

import { useEffect, useState } from "react"
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, type User } from "firebase/auth"
import { collection, getDocs } from "firebase/firestore"
import { auth, db } from "@/lib/firebase"

// Placeholder de Etapa 0/1: confirma que Next.js -> Firebase Auth -> Firestore
// funciona de punta a punta. El formulario real de publicar noticias (Rol 3)
// se construye encima de esto.
export default function Home() {
  const [user, setUser] = useState<User | null>(null)
  const [newsCount, setNewsCount] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => onAuthStateChanged(auth, setUser), [])

  useEffect(() => {
    if (!user) return
    getDocs(collection(db, "news"))
      .then((snap) => setNewsCount(snap.size))
      .catch((e) => setError(e.code ?? String(e)))
  }, [user])

  return (
    <main style={{ padding: 24, fontFamily: "sans-serif", maxWidth: 480 }}>
      <h1>RespAI — Portal admin (placeholder)</h1>
      <p>Esto confirma la conexión Next.js → Firebase Auth → Firestore. No es el formulario final.</p>

      {!user && (
        <button onClick={() => signInWithPopup(auth, new GoogleAuthProvider())}>
          Entrar con Google
        </button>
      )}

      {user && (
        <>
          <p>Sesión: {user.email}</p>
          <button onClick={() => signOut(auth)}>Cerrar sesión</button>
          {error && <p style={{ color: "crimson" }}>Error leyendo Firestore: {error}</p>}
          {newsCount !== null && <p>Noticias en Firestore: {newsCount}</p>}
        </>
      )}
    </main>
  )
}
