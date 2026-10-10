"use client"

import { useState } from "react"
import Link from "next/link"
import { addDoc, collection } from "firebase/firestore"
import { LOCATIONS_LIST } from "@respai/shared"
import { db } from "@/lib/firebase"
import { useAdmin } from "@/lib/auth"
import {
  countsAsEvidence,
  emptyDraft,
  MIN_SOURCES_TO_CONFIRM,
  toNewsDoc,
  validateDraft,
  type DraftSource,
  type NewsDraft,
} from "@/lib/newsDraft"

const SCOPES: { value: NewsDraft["scope"]; label: string; hint: string }[] = [
  { value: "local", label: "Local", hint: "Una región concreta (necesita país y región)." },
  { value: "national", label: "Nacional", hint: "Todo un país." },
  { value: "international", label: "Internacional", hint: "Otro país o alcance global." },
]

const SOURCE_TYPES: { value: DraftSource["type"]; label: string }[] = [
  { value: "original", label: "Original (reporte propio o fuente primaria)" },
  { value: "summary", label: "Resumen de otro medio" },
  { value: "ai", label: "Aporte generado por IA" },
]

const STATUSES: { value: NewsDraft["validationStatus"]; label: string; hint: string }[] = [
  {
    value: "confirmed",
    label: "Confirmada",
    hint: `Al menos ${MIN_SOURCES_TO_CONFIRM} fuentes que no sean IA lo respaldan.`,
  },
  {
    value: "in_progress",
    label: "En desarrollo",
    hint: "Hay información parcial o fuentes que se contradicen. Explica cuáles en la nota.",
  },
  { value: "unverified", label: "No verificada", hint: "Todavía no se puede confirmar. Explica qué falta." },
]

type Saved = { id: string; published: boolean }

// Formulario para crear una noticia. Quien la guarda (y decide su estado de
// validación) es siempre una persona admin; aquí solo se aplican las reglas
// mínimas de lib/newsDraft.ts.
export function NewsForm() {
  const admin = useAdmin()
  const [draft, setDraft] = useState<NewsDraft>(emptyDraft)
  const [errors, setErrors] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState<Saved | null>(null)

  const set = <K extends keyof NewsDraft>(key: K, value: NewsDraft[K]) => setDraft((d) => ({ ...d, [key]: value }))

  const setSource = (i: number, patch: Partial<DraftSource>) =>
    setDraft((d) => ({ ...d, sources: d.sources.map((s, j) => (j === i ? { ...s, ...patch } : s)) }))

  const regions = LOCATIONS_LIST.find((l) => l.country === draft.country)?.regions ?? []
  const evidence = draft.sources.filter(countsAsEvidence).length

  async function save(publish: boolean) {
    const problems = validateDraft(draft, publish ? "publish" : "draft")
    setErrors(problems)
    if (problems.length) return
    setBusy(true)
    try {
      const ref = await addDoc(collection(db, "news"), toNewsDoc(draft, admin.uid, publish))
      setSaved({ id: ref.id, published: publish })
    } catch (e) {
      const code = (e as { code?: string })?.code
      setErrors([
        code === "permission-denied"
          ? "Firestore rechazó la escritura: tu correo no está en isAdmin() de firestore.rules."
          : `No se pudo guardar (${code ?? String(e)}).`,
      ])
    } finally {
      setBusy(false)
    }
  }

  if (saved) {
    return (
      <div className="card">
        <h2>{saved.published ? "Noticia publicada" : "Borrador guardado"}</h2>
        <p className="muted">
          {saved.published
            ? "Ya está en Firestore con fecha de publicación: aparece en la app según la ubicación de cada persona."
            : "Quedó guardada sin fecha de publicación: la app no la muestra todavía."}
        </p>
        <p className="muted small">
          ID: <code>{saved.id}</code>
        </p>
        <div className="form-actions">
          <button
            className="btn"
            onClick={() => {
              setDraft(emptyDraft())
              setErrors([])
              setSaved(null)
            }}
          >
            Crear otra
          </button>
          <Link href="/" className="btn btn-primary">
            Volver al inicio
          </Link>
        </div>
      </div>
    )
  }

  return (
    <form
      className="news-form"
      onSubmit={(e) => {
        e.preventDefault()
        save(true)
      }}
    >
      <section className="card">
        <h2>Contenido</h2>
        <label className="field">
          <span>Título</span>
          <input value={draft.title} onChange={(e) => set("title", e.target.value)} maxLength={160} />
        </label>
        <label className="field">
          <span>Resumen</span>
          <span className="muted small">Una o dos frases. Es lo que se ve en el feed.</span>
          <textarea rows={2} value={draft.summary} onChange={(e) => set("summary", e.target.value)} maxLength={400} />
        </label>
        <label className="field">
          <span>Cuerpo</span>
          <textarea rows={8} value={draft.body} onChange={(e) => set("body", e.target.value)} />
        </label>
        <label className="field">
          <span>Temas</span>
          <span className="muted small">Separados por coma, por ejemplo: economía, salud</span>
          <input value={draft.topics} onChange={(e) => set("topics", e.target.value)} />
        </label>
      </section>

      <section className="card">
        <h2>Alcance geográfico</h2>
        <div className="choice-row" role="radiogroup" aria-label="Alcance">
          {SCOPES.map((s) => (
            <label key={s.value} className={`choice ${draft.scope === s.value ? "selected" : ""}`}>
              <input
                type="radio"
                name="scope"
                checked={draft.scope === s.value}
                onChange={() => set("scope", s.value)}
              />
              <strong>{s.label}</strong>
              <span className="muted small">{s.hint}</span>
            </label>
          ))}
        </div>

        <div className="field-row">
          <label className="field">
            <span>País{draft.scope === "international" && " (opcional)"}</span>
            {draft.scope === "international" ? (
              <>
                <input
                  list="countries"
                  value={draft.country}
                  onChange={(e) => set("country", e.target.value)}
                  placeholder="Vacío = alcance global"
                />
                <datalist id="countries">
                  {LOCATIONS_LIST.map((l) => (
                    <option key={l.country} value={l.country} />
                  ))}
                </datalist>
              </>
            ) : (
              <select
                value={draft.country}
                onChange={(e) => setDraft((d) => ({ ...d, country: e.target.value, region: "" }))}
              >
                <option value="">Elegir…</option>
                {LOCATIONS_LIST.map((l) => (
                  <option key={l.country}>{l.country}</option>
                ))}
              </select>
            )}
          </label>

          {draft.scope !== "international" && (
            <label className="field">
              <span>Región{draft.scope === "national" && " (opcional)"}</span>
              <select
                value={draft.region}
                onChange={(e) => set("region", e.target.value)}
                disabled={!draft.country}
              >
                <option value="">{draft.scope === "national" ? "Todo el país" : "Elegir…"}</option>
                {regions.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </label>
          )}
        </div>
      </section>

      <section className="card">
        <h2>Fuentes</h2>
        <p className="muted small">
          De dónde sale la información. Una fuente marcada como IA se muestra al lector, pero nunca cuenta como prueba.
        </p>
        {draft.sources.map((s, i) => (
          <div key={i} className="source-row">
            <label className="field">
              <span>Nombre</span>
              <input
                value={s.name}
                onChange={(e) => setSource(i, { name: e.target.value })}
                placeholder="Ej. Ministerio de Salud"
              />
            </label>
            <label className="field">
              <span>URL (opcional)</span>
              <input
                type="url"
                value={s.url}
                onChange={(e) => setSource(i, { url: e.target.value })}
                placeholder="https://…"
              />
            </label>
            <label className="field">
              <span>Tipo</span>
              <select value={s.type} onChange={(e) => setSource(i, { type: e.target.value as DraftSource["type"] })}>
                {SOURCE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => setDraft((d) => ({ ...d, sources: d.sources.filter((_, j) => j !== i) }))}
              disabled={draft.sources.length === 1}
              aria-label={`Quitar fuente ${i + 1}`}
            >
              Quitar
            </button>
          </div>
        ))}
        <div>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => setDraft((d) => ({ ...d, sources: [...d.sources, { name: "", url: "", type: "original" }] }))}
          >
            + Agregar fuente
          </button>
        </div>
      </section>

      <section className="card">
        <h2>Validación</h2>
        <p className="muted small">
          Lo decides tú, no la IA ni el sistema. Fuentes que cuentan como prueba: {evidence} de {MIN_SOURCES_TO_CONFIRM}{" "}
          necesarias para confirmar.
        </p>
        <div className="choice-row" role="radiogroup" aria-label="Estado de validación">
          {STATUSES.map((s) => (
            <label key={s.value} className={`choice status-${s.value} ${draft.validationStatus === s.value ? "selected" : ""}`}>
              <input
                type="radio"
                name="validationStatus"
                checked={draft.validationStatus === s.value}
                onChange={() => set("validationStatus", s.value)}
              />
              <strong>{s.label}</strong>
              <span className="muted small">{s.hint}</span>
            </label>
          ))}
        </div>
        <label className="field">
          <span>Nota de validación{draft.validationStatus === "confirmed" && " (opcional)"}</span>
          <span className="muted small">Por qué tiene este estado, qué falta confirmar o qué fuentes se contradicen.</span>
          <textarea rows={3} value={draft.validationNote} onChange={(e) => set("validationNote", e.target.value)} />
        </label>
      </section>

      {errors.length > 0 && (
        <div className="card form-errors" role="alert">
          <strong>Antes de guardar, revisa:</strong>
          <ul>
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="form-actions">
        <button type="button" className="btn" onClick={() => save(false)} disabled={busy}>
          Guardar borrador
        </button>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? "Guardando…" : "Publicar"}
        </button>
      </div>
    </form>
  )
}
