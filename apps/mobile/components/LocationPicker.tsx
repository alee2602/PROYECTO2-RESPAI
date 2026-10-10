"use client"

import { useState } from "react"
import { useProfile } from "@/lib/profile"
import { LOCATIONS, type UserLocation } from "@/lib/locations"

// Selector de ubicación simulada. Se usa la primera vez (LocationGate) y en
// /ubicacion para cambiarla. Nunca pide permiso de GPS.
export function LocationPicker({ firstTime = false, onSaved }: { firstTime?: boolean; onSaved?: () => void }) {
  const { location, saveLocation } = useProfile()
  const [country, setCountry] = useState<string>(location?.country ?? "")
  const [region, setRegion] = useState<string | null>(location?.region ?? null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const regions = LOCATIONS.find((l) => l.country === country)?.regions ?? []

  function pickCountry(c: string) {
    setCountry(c)
    setRegion(null)
  }

  async function handleSave() {
    if (!country) return
    setBusy(true)
    setError(null)
    try {
      const loc: UserLocation = { country, region }
      await saveLocation(loc)
      onSaved?.()
    } catch (e) {
      setError(`No se pudo guardar la ubicación (${(e as { code?: string }).code ?? "error"}). Inténtalo de nuevo.`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="picker">
      <header>
        <h1>{firstTime ? "¿Desde dónde quieres leer?" : "Cambiar ubicación"}</h1>
        <p className="muted">
          Es una <strong>ubicación simulada</strong>: tú la eliges y puedes cambiarla cuando quieras. Ordena tu feed,
          pero nunca esconde noticias nacionales o internacionales. No usamos el GPS de tu teléfono.
        </p>
      </header>

      <fieldset>
        <legend>País</legend>
        <div className="chips">
          {LOCATIONS.map((l) => (
            <button
              key={l.country}
              type="button"
              className="chip"
              aria-pressed={country === l.country}
              onClick={() => pickCountry(l.country)}
            >
              {l.country}
            </button>
          ))}
        </div>
      </fieldset>

      {country && (
        <fieldset>
          <legend>Región</legend>
          <div className="chips">
            <button type="button" className="chip" aria-pressed={region === null} onClick={() => setRegion(null)}>
              Todo el país
            </button>
            {regions.map((r) => (
              <button key={r} type="button" className="chip" aria-pressed={region === r} onClick={() => setRegion(r)}>
                {r}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      <button className="btn btn-primary" onClick={handleSave} disabled={!country || busy}>
        {busy ? "Guardando…" : "Guardar ubicación"}
      </button>
    </section>
  )
}
