"use client"

import { useState } from "react"
import { useProfile } from "@/lib/profile"
import { findCountry, formatLocation, LOCATIONS, type UserLocation } from "@/lib/locations"
import { COUNTRY_MAPS, WORLD_MAP } from "@/lib/maps.generated"
import { DotMap, Flag } from "@/components/DotMap"

// Selector de ubicación simulada. Se usa la primera vez (LocationGate) y en
// /ubicacion para cambiarla. Nunca pide permiso de GPS ni la infiere por IP.
export function LocationPicker({ firstTime = false, onSaved }: { firstTime?: boolean; onSaved?: () => void }) {
  const { location, saveLocation } = useProfile()
  const [country, setCountry] = useState<string>(location?.country ?? "")
  const [region, setRegion] = useState<string | null>(location?.region ?? null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const def = findCountry(country)

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
      <header className="picker-head">
        <p className="eyebrow">Ubicación simulada</p>
        <h1>{firstTime ? "¿Desde dónde quieres leer?" : "Cambiar ubicación"}</h1>
        <p>Tú la eliges y la cambias cuando quieras. No usamos el GPS de tu teléfono.</p>
      </header>

      <figure className="map-card">
        <div className="map-card-canvas">
          {def ? (
            <DotMap
              key={def.country}
              map={COUNTRY_MAPS[def.country]}
              active={region}
              label={`Mapa de ${def.country}${region ? `, con ${region} marcada` : ""}`}
            />
          ) : (
            <DotMap map={WORLD_MAP} dots={LOCATIONS.map((l) => l.country)} label="Mapa del mundo" />
          )}
          {def && (
            <span className="map-card-tag">
              <Flag code={def.flag} />
              {region ?? "Todo el país"}
            </span>
          )}
        </div>
        <figcaption>
          Lo más cercano a ti aparece primero. Las noticias de tu país y del mundo{" "}
          <strong>siguen en tu feed</strong>.
        </figcaption>
      </figure>

      <fieldset>
        <legend>País</legend>
        <div className="country-list">
          {LOCATIONS.map((l) => (
            <button
              key={l.country}
              type="button"
              className="country-row"
              aria-pressed={country === l.country}
              onClick={() => pickCountry(l.country)}
            >
              <Flag code={l.flag} />
              <span className="country-name">{l.country}</span>
              <span className="country-meta">{l.regions.length} regiones</span>
              <span className="radio" aria-hidden="true" />
            </button>
          ))}
        </div>
      </fieldset>

      {def && (
        <fieldset key={def.country} className="region-fieldset">
          <legend>Región en {def.country}</legend>
          <div className="chips">
            <button type="button" className="chip" aria-pressed={region === null} onClick={() => setRegion(null)}>
              Todo el país
            </button>
            {def.regions.map((r) => (
              <button
                key={r.name}
                type="button"
                className="chip"
                aria-pressed={region === r.name}
                onClick={() => setRegion(r.name)}
              >
                {r.name}
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

      <div className="picker-bar">
        <p className="picker-summary">
          {country ? (
            <>
              <span className="muted small">Leerás desde</span>
              <strong>{formatLocation({ country, region })}</strong>
            </>
          ) : (
            <span className="muted small">Elige un país para empezar</span>
          )}
        </p>
        <button className="btn btn-primary" onClick={handleSave} disabled={!country || busy}>
          {busy ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </section>
  )
}
