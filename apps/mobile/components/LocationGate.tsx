"use client"

import type { ReactNode } from "react"
import { useProfile } from "@/lib/profile"
import { LocationPicker } from "@/components/LocationPicker"

// Segundo portero (después de AuthGate): sin ubicación elegida no hay feed que
// personalizar, así que la primera vez se pide antes de mostrar la app.
export function LocationGate({ children }: { children: ReactNode }) {
  const { location, error } = useProfile()

  if (error) {
    return (
      <main className="center-screen">
        <p className="error" role="alert">
          No se pudo leer tu perfil ({error}). Revisa tu conexión y recarga la app.
        </p>
      </main>
    )
  }
  if (location === undefined) {
    return (
      <main className="center-screen" aria-busy="true">
        <p className="muted">Cargando tu ubicación…</p>
      </main>
    )
  }
  if (location === null) {
    return (
      <main className="screen">
        <LocationPicker firstTime />
      </main>
    )
  }
  return <>{children}</>
}
