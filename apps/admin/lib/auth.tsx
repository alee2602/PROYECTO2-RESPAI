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
import { checkIsAdmin } from "@/lib/admins"

// Sesión del portal. Mismo método que la PWA (signInWithPopup, ver
// docs/ciclos.md 2026-09-30); aquí además se sabe si el correo es admin.

type AuthState = {
  user: User | null
  isAdmin: boolean
  loading: boolean // true mientras Firebase revisa si ya había sesión guardada
  signIn: () => Promise<void>
  logOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [adminLoading, setAdminLoading] = useState(false)

  useEffect(
    () =>
      onAuthStateChanged(auth, (u) => {
        setUser(u)
        setAuthLoading(false)
      }),
    []
  )

  // El chequeo de admin ahora es una lectura a Firestore (ver lib/admins.ts),
  // no una lista en memoria — por eso es async y necesita su propio loading
  // para que <AdminGate> no muestre "sin acceso" un instante antes de saber.
  useEffect(() => {
    if (!user) {
      setIsAdmin(false)
      setAdminLoading(false)
      return
    }
    let cancelled = false
    setAdminLoading(true)
    checkIsAdmin(user.email).then((ok) => {
      if (!cancelled) {
        setIsAdmin(ok)
        setAdminLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [user])

  async function signIn() {
    await setPersistence(auth, browserLocalPersistence)
    const provider = new GoogleAuthProvider()
    provider.setCustomParameters({ prompt: "select_account" })
    await signInWithPopup(auth, provider)
  }

  async function logOut() {
    await signOut(auth)
  }

  const loading = authLoading || adminLoading

  return <AuthContext value={{ user, isAdmin, loading, signIn, logOut }}>{children}</AuthContext>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>")
  return ctx
}

// Para pantallas que ya están detrás de <AdminGate>: ahí siempre hay un admin.
export function useAdmin(): User {
  const { user, isAdmin } = useAuth()
  if (!user || !isAdmin) throw new Error("useAdmin solo funciona detrás de <AdminGate>")
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
