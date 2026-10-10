"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import {
  browserLocalPersistence,
  GoogleAuthProvider,
  onAuthStateChanged,
  setPersistence,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth"
import { auth } from "@/lib/firebase"

// Sesión de la PWA. Método decidido: signInWithPopup (probado en iPhone real,
// ver docs/ciclos.md 2026-09-30 y 2026-10-09). La sesión se guarda en el
// almacenamiento local del navegador (browserLocalPersistence), así que
// sobrevive a cerrar y reabrir la app instalada.

type AuthState = {
  user: User | null
  loading: boolean // true mientras Firebase revisa si ya había sesión guardada
  signIn: () => Promise<void>
  logOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(
    () =>
      onAuthStateChanged(auth, (u) => {
        setUser(u)
        setLoading(false)
      }),
    []
  )

  async function signIn() {
    await setPersistence(auth, browserLocalPersistence)
    const provider = new GoogleAuthProvider()
    provider.setCustomParameters({ prompt: "select_account" })
    await signInWithPopup(auth, provider)
  }

  async function logOut() {
    await signOut(auth)
  }

  return <AuthContext value={{ user, loading, signIn, logOut }}>{children}</AuthContext>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>")
  return ctx
}

// Para pantallas que ya están detrás de <AuthGate>: ahí siempre hay usuario.
export function useUser(): User {
  const { user } = useAuth()
  if (!user) throw new Error("useUser solo funciona detrás de <AuthGate>")
  return user
}

// Mensajes en español para los errores de login más comunes.
export function authErrorMessage(e: unknown): string {
  const code = (e as { code?: string })?.code ?? ""
  switch (code) {
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return "Se cerró la ventana de Google antes de terminar. Inténtalo de nuevo."
    case "auth/popup-blocked":
      return "El navegador bloqueó la ventana de Google. Permite ventanas emergentes para este sitio e inténtalo de nuevo."
    case "auth/network-request-failed":
      return "No hay conexión a internet. Revisa tu red e inténtalo de nuevo."
    case "auth/unauthorized-domain":
      return "Este dominio no está autorizado en Firebase Authentication. Avisa al equipo."
    default:
      return `No se pudo iniciar sesión (${code || "error desconocido"}).`
  }
}
