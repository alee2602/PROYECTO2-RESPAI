"use client"

import { useState, type ReactNode } from "react"
import { authErrorMessage, useAuth } from "@/lib/auth"

// Guard de rutas: toda la app vive detrás de este componente. Sin sesión no se
// puede leer la colección `news` (las reglas de Firestore exigen usuario
// autenticado), así que no tiene sentido mostrar ninguna pantalla sin login.
export function AuthGate({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) return <Splash />
  if (!user) return <LoginScreen />
  return <>{children}</>
}

function Splash() {
  return (
    <main className="center-screen" aria-busy="true">
      <p className="brand">RespAI News</p>
      <p className="muted">Revisando tu sesión…</p>
    </main>
  )
}

function LoginScreen() {
  const { signIn } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSignIn() {
    setBusy(true)
    setError(null)
    try {
      await signIn()
    } catch (e) {
      setError(authErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="center-screen">
      <p className="brand">RespAI News</p>
      <p className="login-pitch">
        Noticias según la ubicación que tú eliges, con su fuente y su estado de verificación siempre a la vista.
      </p>
      <button className="btn btn-primary" onClick={handleSignIn} disabled={busy}>
        {busy ? "Abriendo Google…" : "Entrar con Google"}
      </button>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <p className="muted small">
        Solo usamos tu cuenta para guardar la ubicación que elijas y lo que lees. Nunca usamos tu GPS.
      </p>
    </main>
  )
}
