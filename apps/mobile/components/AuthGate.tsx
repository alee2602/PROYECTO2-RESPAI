"use client"

import { useState, type ReactNode } from "react"
import { authErrorMessage, useAuth } from "@/lib/auth"
import { LOCATIONS } from "@/lib/locations"
import { WORLD_MAP } from "@/lib/maps.generated"
import { ValidationBadge } from "@/components/Badges"
import { DotMap } from "@/components/DotMap"

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
      <p className="wordmark wordmark-lg">
        Resp<span>AI</span> News
      </p>
      <span className="spinner" />
      <p className="muted small">Revisando tu sesión…</p>
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
    <main className="login">
      {/* Ilustración: mapa + tarjeta de ejemplo (así se ve una noticia en la app) */}
      <div className="login-visual" aria-hidden="true">
        <DotMap map={WORLD_MAP} active={LOCATIONS[0].country} dots={LOCATIONS.slice(1).map((l) => l.country)} label="" />
        <div className="anatomy-card">
          <p className="anatomy-kicker">
            Local · Quetzaltenango <span>Ejemplo</span>
          </p>
          <p className="anatomy-title">La feria de Xela anuncia su cartel de artistas</p>
          <div className="anatomy-row">
            <ValidationBadge status="confirmed" size="sm" />
          </div>
          <div className="anatomy-row">
            <span className="anatomy-source">
              Comité de Feria <span>· Original</span>
            </span>
          </div>
          <div className="anatomy-row">
            <span className="anatomy-reason">
              <svg width="12" height="12" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z"
                />
              </svg>
              Ocurre en tu región
            </span>
          </div>
        </div>
      </div>

      <div className="login-copy">
        <h1 className="login-brand">
          Resp<span>AI</span> News
        </h1>
        <p className="login-tagline">
          Noticias de donde <mark className="scribble">tú eliges</mark>, con su <mark className="scribble">fuente</mark> a la
          vista.
        </p>
      </div>

      <div className="login-actions">
        <button className="btn btn-primary btn-google" onClick={handleSignIn} disabled={busy}>
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path fill="#4285F4" d="M22.6 12.2c0-.8-.1-1.5-.2-2.2H12v4.2h6a5.1 5.1 0 0 1-2.2 3.4v2.8h3.6c2.1-2 3.2-4.8 3.2-8.2Z" />
            <path fill="#34A853" d="M12 23c3 0 5.5-1 7.4-2.7l-3.6-2.8c-1 .7-2.3 1.1-3.8 1.1-2.9 0-5.4-2-6.3-4.6H2v2.9A11 11 0 0 0 12 23Z" />
            <path fill="#FBBC05" d="M5.7 14c-.2-.7-.4-1.4-.4-2s.1-1.4.4-2V7.1H2A11 11 0 0 0 1 12c0 1.8.4 3.5 1.2 4.9L5.7 14Z" />
            <path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2 7.1L5.7 10C6.6 7.4 9 5.4 12 5.4Z" />
          </svg>
          {busy ? "Abriendo Google…" : "Continuar con Google"}
        </button>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <p className="muted small">Solo guardamos la ubicación que elijas y qué noticias abres, para ordenar tu feed.</p>
      </div>
    </main>
  )
}
