"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { addDoc, collection, deleteDoc, deleteField, doc, serverTimestamp, updateDoc } from "firebase/firestore"
import { LOCATIONS_LIST } from "@respai/shared"
import { db } from "@/lib/firebase"
import { useAdmin } from "@/lib/auth"
import { STATUS_LABEL } from "@/lib/labels"
import { knownOutlet, newsSearchUrl, outletsFor } from "@/lib/outlets"
import {
  CONTRADICTION_PREFIX,
  diagnose,
  emptyDraft,
  evidenceCount,
  MIN_SOURCES_TO_CONFIRM,
  sourceGroups,
  toNewsDoc,
  toNewsUpdate,
  validateDraft,
  type Diagnosis,
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

const STATUSES: { value: NewsDraft["validationStatus"]; hint: string }[] = [
  { value: "confirmed", hint: `Al menos ${MIN_SOURCES_TO_CONFIRM} fuentes que no sean IA lo respaldan.` },
  { value: "in_progress", hint: "Hay información parcial o fuentes que se contradicen. Explica cuáles en la nota." },
  { value: "unverified", hint: "Todavía no se puede confirmar. Explica qué falta." },
]

const DIAGNOSIS_TITLE: Record<Diagnosis, string> = {
  contradiction: "Caso: fuentes que se contradicen",
  insufficient: "Caso: fuente insuficiente",
  enough: "Fuentes suficientes",
}

const BLOCKED_HINT: Record<Diagnosis, string> = {
  contradiction: "No disponible: declaraste que las fuentes se contradicen.",
  insufficient: `No disponible: hacen falta ${MIN_SOURCES_TO_CONFIRM} fuentes distintas que no sean IA.`,
  enough: "",
}

const NOTE_PLACEHOLDER: Record<Diagnosis, string> = {
  contradiction: "Ej. El Banco Central proyecta 2.7% y Goldman Sachs 3%; ninguna fuente confirma la cifra final.",
  insufficient: "Ej. Solo lo reporta AGN; no se encontró en otro medio ni en un comunicado oficial.",
  enough: "Ej. El hecho sigue en curso: falta el dato oficial de cierre.",
}

// Por qué una fuente cuenta o no como prueba, bajo cada fila.
function SourceHint({ source, duplicateOf }: { source: DraftSource; duplicateOf: number | null }) {
  if (!source.name.trim()) return null
  const outlet = knownOutlet(source.url)
  const notes = [
    source.type === "ai" && "Aporte de IA: se muestra, pero no cuenta como prueba.",
    duplicateOf && `Mismo medio que la fuente ${duplicateOf}: no suma como segunda fuente.`,
    outlet && `Medio de referencia: ${outlet.name}.`,
  ].filter(Boolean)
  if (!notes.length) return null
  return <p className="source-hint muted small">{notes.join(" ")}</p>
}

type Action = "draft" | "publish" | "unpublish"

const DONE_MESSAGE: Record<Action, { title: string; text: string }> = {
  publish: {
    title: "Noticia publicada",
    text: "Ya está en Firestore con fecha de publicación: aparece en la app según la ubicación de cada persona.",
  },
  draft: { title: "Borrador guardado", text: "Quedó guardada sin fecha de publicación: la app no la muestra." },
  unpublish: {
    title: "Noticia despublicada",
    text: "Se le quitó la fecha de publicación: la app deja de mostrarla. No se borró nada; puedes volver a publicarla.",
  },
}

// Noticia que ya existe en Firestore (modo edición).
export type ExistingNews = { id: string; published: boolean; draft: NewsDraft }

// Formulario para crear o editar una noticia. Quien la guarda (y decide su
// estado de validación) es siempre una persona admin; aquí solo se aplican las
// reglas mínimas de lib/newsDraft.ts.
export function NewsForm({ existing }: { existing?: ExistingNews }) {
  const admin = useAdmin()
  const router = useRouter()
  const [id, setId] = useState(existing?.id ?? null)
  const [published, setPublished] = useState(existing?.published ?? false)
  const [draft, setDraft] = useState<NewsDraft>(() => existing?.draft ?? emptyDraft())
  const [errors, setErrors] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<Action | null>(null)
  const [editedLive, setEditedLive] = useState(false) // se guardaron cambios de una noticia ya publicada

  const set = <K extends keyof NewsDraft>(key: K, value: NewsDraft[K]) => setDraft((d) => ({ ...d, [key]: value }))

  const setSource = (i: number, patch: Partial<DraftSource>) =>
    setDraft((d) => ({ ...d, sources: d.sources.map((s, j) => (j === i ? { ...s, ...patch } : s)) }))

  const regions = LOCATIONS_LIST.find((l) => l.country === draft.country)?.regions ?? []
  const evidence = evidenceCount(draft.sources)
  const groups = sourceGroups(draft.sources)
  const diagnosis = diagnose(draft)
  const hasAi = draft.sources.some((s) => s.type === "ai" && s.name.trim())
  const outlets = outletsFor(draft.country)

  async function run(task: () => Promise<void>) {
    setBusy(true)
    try {
      await task()
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

  // Publicar (o guardar cambios de una publicada, que ya está visible) exige la
  // noticia completa; borrador y despublicar solo lo mínimo.
  function save(action: Action) {
    const problems = validateDraft(draft, action === "publish" ? "publish" : "draft")
    setErrors(problems)
    if (problems.length) return
    run(async () => {
      if (!id) {
        const ref = await addDoc(collection(db, "news"), toNewsDoc(draft, admin.uid, action === "publish"))
        setId(ref.id)
      } else {
        const update = toNewsUpdate(draft)
        if (action === "publish" && !published) update.publishedAt = serverTimestamp()
        if (action === "unpublish") update.publishedAt = deleteField()
        await updateDoc(doc(db, "news", id), update)
      }
      setEditedLive(action === "publish" && published)
      setPublished(action === "publish")
      setDone(action)
    })
  }

  function remove() {
    if (!id || !window.confirm(`¿Borrar "${draft.title || "esta noticia"}"? Esto no se puede deshacer.`)) return
    run(async () => {
      await deleteDoc(doc(db, "news", id))
      router.push("/")
    })
  }

  if (done) {
    const msg = DONE_MESSAGE[done]
    return (
      <div className="card">
        <h2>{editedLive ? "Cambios guardados" : msg.title}</h2>
        <p className="muted">{msg.text}</p>
        <p className="muted small">
          ID: <code>{id}</code>
        </p>
        <div className="form-actions">
          {existing ? (
            <button className="btn" onClick={() => setDone(null)}>
              Seguir editando
            </button>
          ) : (
            <button
              className="btn"
              onClick={() => {
                setId(null)
                setPublished(false)
                setDraft(emptyDraft())
                setErrors([])
                setDone(null)
              }}
            >
              Crear otra
            </button>
          )}
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
        save("publish")
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

        <div className="verify-box">
          <strong>¿Otros medios también lo reportan?</strong>
          {draft.title.trim() ? (
            <>
              <span className="muted small">
                Busca el título en Google Noticias y abre los resultados en otra pestaña. Si un medio lo confirma, agrégalo
                como fuente. El portal no consulta nada por su cuenta.
              </span>
              <div className="verify-links">
                <a
                  className="btn btn-sm"
                  href={newsSearchUrl(draft.title, outlets)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Buscar en medios de referencia ↗
                </a>
                <a className="btn btn-sm" href={newsSearchUrl(draft.title)} target="_blank" rel="noopener noreferrer">
                  Buscar en todo Google Noticias ↗
                </a>
              </div>
              <span className="muted small">
                Medios de referencia{draft.country.trim() && ` (${draft.country.trim()} + internacionales)`}:{" "}
                {outlets.map((o) => o.name).join(", ")}. Estar en esta lista no vuelve verdadera una noticia.
              </span>
            </>
          ) : (
            <span className="muted small">Escribe el título para poder buscarlo en otros medios.</span>
          )}
        </div>
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
            <SourceHint source={s} duplicateOf={groups[i] !== -1 && groups[i] !== i ? groups[i]! + 1 : null} />
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

        <div className="ai-notice">
          <strong>Ningún texto generado por IA se publica sin revisión humana.</strong>
          {hasAi ? (
            <label className="check">
              <input
                type="checkbox"
                checked={draft.aiReviewed}
                onChange={(e) => set("aiReviewed", e.target.checked)}
              />
              <span>Revisé y edité el texto aportado por IA, y comprobé sus datos contra las otras fuentes.</span>
            </label>
          ) : (
            <span className="muted small">Si usas un aporte de IA, agrégalo como fuente de tipo IA para que el lector lo vea.</span>
          )}
        </div>
      </section>

      <section className="card">
        <h2>Validación</h2>
        <p className="muted small">Lo decides tú, no la IA ni el sistema. El portal solo te impide lo que no se sostiene.</p>

        <div className={`diagnosis ${diagnosis}`} aria-live="polite">
          <strong>{DIAGNOSIS_TITLE[diagnosis]}</strong>
          <span className="small">
            {diagnosis === "contradiction" &&
              `Queda En desarrollo hasta que se aclare. En la nota, explica qué dice cada fuente; se guardará empezando con "${CONTRADICTION_PREFIX}".`}
            {diagnosis === "insufficient" &&
              `Hay ${evidence} de ${MIN_SOURCES_TO_CONFIRM} fuentes distintas que no son IA. No se puede confirmar todavía: márcala No verificada (o En desarrollo si el hecho sigue ocurriendo), explica qué falta y busca una segunda fuente en otros medios.`}
            {diagnosis === "enough" &&
              (draft.validationStatus === "confirmed"
                ? `La confirmas tú, con ${evidence} fuentes distintas que la respaldan.`
                : `Hay ${evidence} fuentes distintas: alcanza para confirmar, pero la decisión es tuya. Si el hecho sigue en curso o tienes dudas, déjala sin confirmar y explica por qué.`)}
          </span>
        </div>

        <label className="check">
          <input
            type="checkbox"
            checked={draft.contradicts}
            onChange={(e) => {
              const contradicts = e.target.checked
              setDraft((d) => ({ ...d, contradicts, validationStatus: contradicts ? "in_progress" : d.validationStatus }))
            }}
          />
          <span>Las fuentes se contradicen (por ejemplo, dan cifras o versiones distintas del mismo hecho)</span>
        </label>

        <div className="choice-row" role="radiogroup" aria-label="Estado de validación">
          {STATUSES.map((s) => {
            const blocked =
              (s.value === "confirmed" && diagnosis !== "enough") || (s.value !== "in_progress" && draft.contradicts)
            return (
              <label
                key={s.value}
                className={`choice status-${s.value} ${draft.validationStatus === s.value ? "selected" : ""} ${blocked ? "blocked" : ""}`}
              >
                <input
                  type="radio"
                  name="validationStatus"
                  checked={draft.validationStatus === s.value}
                  disabled={blocked}
                  onChange={() => set("validationStatus", s.value)}
                />
                <strong>{STATUS_LABEL[s.value]}</strong>
                <span className="muted small">{blocked ? BLOCKED_HINT[diagnosis] : s.hint}</span>
              </label>
            )
          })}
        </div>
        <label className="field">
          <span>Nota de validación{draft.validationStatus === "confirmed" && " (opcional)"}</span>
          <span className="muted small">Por qué tiene este estado, qué falta confirmar o qué fuentes se contradicen.</span>
          <textarea
            rows={3}
            value={draft.validationNote}
            onChange={(e) => set("validationNote", e.target.value)}
            placeholder={NOTE_PLACEHOLDER[diagnosis]}
          />
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

      {existing && (
        <p className="muted small">
          {published
            ? "Esta noticia está publicada: los cambios se ven en la app en cuanto los guardes."
            : "Esta noticia es un borrador: la app no la muestra."}
        </p>
      )}
      <div className="form-actions">
        {existing && (
          <button type="button" className="btn btn-danger" onClick={remove} disabled={busy}>
            Borrar
          </button>
        )}
        <span className="spacer" />
        {published ? (
          <button type="button" className="btn" onClick={() => save("unpublish")} disabled={busy}>
            Despublicar
          </button>
        ) : (
          <button type="button" className="btn" onClick={() => save("draft")} disabled={busy}>
            Guardar borrador
          </button>
        )}
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? "Guardando…" : published ? "Guardar cambios" : "Publicar"}
        </button>
      </div>
    </form>
  )
}
