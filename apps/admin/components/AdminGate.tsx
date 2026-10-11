"use client"

import { useState, type ReactNode } from "react"
import { authErrorMessage, useAuth } from "@/lib/auth"

// Guard del portal: sin sesión → login; con sesión pero sin ser admin → "sin
// acceso". Solo los admins ven el resto del portal. (La escritura en Firestore
// la vuelven a validar las reglas del servidor, ver lib/admins.ts.)
export function AdminGate({ children }: { children: ReactNode }) {
  const { user, isAdmin, loading } = useAuth()

  if (loading) return <Splash />
  if (!user) return <LoginScreen />
  if (!isAdmin) return <NoAccess email={user.email} />
  return <>{children}</>
}

function Splash() {
  return (
    <main className="center-screen" aria-busy="true">
      <p className="wordmark">
        Resp<span>AI</span> Portal
      </p>
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
      <div className="card narrow">
        <p className="wordmark">
          Resp<span>AI</span> Portal
        </p>
        <h1>Portal de redacción</h1>
        <p className="muted">
          Aquí una persona crea, valida y publica las noticias que ve la app. Solo los correos autorizados del
          equipo pueden entrar.
        </p>
        <button className="btn btn-primary" onClick={handleSignIn} disabled={busy}>
          {busy ? "Abriendo Google…" : "Entrar con Google"}
        </button>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </div>
    </main>
  )
}

function NoAccess({ email }: { email: string | null }) {
  const { logOut } = useAuth()
  return (
    <main className="center-screen">
      <div className="card narrow">
        <h1>Sin acceso al portal</h1>
        <p>
          Entraste como <strong>{email ?? "(sin correo)"}</strong>, que no está en la lista de administradores.
        </p>
        <p className="muted">
          Publicar y cambiar el estado de validación de una noticia es una decisión humana reservada a personas
          autorizadas. Si necesitas acceso, pídeselo a un administrador del portal.
        </p>
        <button className="btn" onClick={logOut}>
          Cerrar sesión y usar otra cuenta
        </button>
      </div>
    </main>
  )
}
