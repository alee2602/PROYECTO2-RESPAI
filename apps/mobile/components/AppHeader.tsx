"use client"

import { useAuth, useUser } from "@/lib/auth"
import { LocationChip } from "@/components/LocationChip"

// Encabezado fijo arriba (respeta el notch con --safe-top).
export function AppHeader() {
  const user = useUser()
  const { logOut } = useAuth()
  const today = new Date().toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long" })
  const initial = (user.displayName ?? user.email ?? "?").trim().charAt(0).toUpperCase()

  return (
    <header className="app-header">
      <div className="app-header-row">
        <div>
          <p className="wordmark">
            Resp<span>AI</span> News
          </p>
          <p className="app-header-date">{today}</p>
        </div>
        <details className="account">
          <summary aria-label="Tu cuenta">
            {user.photoURL ? (
              <img src={user.photoURL} alt="" referrerPolicy="no-referrer" />
            ) : (
              <span>{initial}</span>
            )}
          </summary>
          <div className="account-menu">
            <p className="account-name">{user.displayName ?? "Tu cuenta"}</p>
            <p className="muted small">{user.email}</p>
            <button className="btn" onClick={logOut}>
              Cerrar sesión
            </button>
          </div>
        </details>
      </div>
      <LocationChip />
    </header>
  )
}
