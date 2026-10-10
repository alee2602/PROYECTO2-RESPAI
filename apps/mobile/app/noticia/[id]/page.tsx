"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import type { News } from "@respai/shared"
import { fetchNewsById, newsDate } from "@/lib/news"
import { reasonFor } from "@/lib/feed"
import { useLocation } from "@/lib/profile"
import { IMAGE_ORIGIN_LABEL, SCOPE_LABEL, VALIDATION_HINT, VALIDATION_LABEL } from "@/lib/labels"
import { SourceTypeBadge, ValidationBadge } from "@/components/Badges"
import { NewsImage } from "@/components/NewsImage"
import { TopBar } from "@/components/TopBar"

// Lector de noticia. Muestra SIEMPRE: estado de validación (con su nota),
// procedencia (todas las fuentes con su tipo) y el origen de la imagen.
export default function NoticiaPage() {
  const { id } = useParams<{ id: string }>()
  const location = useLocation()
  // undefined = cargando; null = no existe / no publicada / incompleta
  const [news, setNews] = useState<News | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchNewsById(id)
      .then((n) => !cancelled && setNews(n))
      .catch((e) => !cancelled && setError(e.code ?? String(e)))
    return () => {
      cancelled = true
    }
  }, [id])

  return (
    <>
      <TopBar title={news ? SCOPE_LABEL[news.scope] : "Noticia"} action={news ? <ShareButton news={news} /> : undefined} />
      <main className="reader">
        {error && (
          <div className="state-box" role="alert">
            <p className="error">No se pudo cargar la noticia ({error}).</p>
            <Link href="/feed" className="btn">
              Volver al feed
            </Link>
          </div>
        )}
        {news === undefined && !error && <ReaderSkeleton />}
        {news === null && (
          <div className="state-box">
            <p>
              <strong>No podemos mostrar esta noticia.</strong>
            </p>
            <p className="muted">
              No existe, todavía no está publicada o le falta su estado de validación o su fuente. Preferimos no
              mostrarla incompleta.
            </p>
            <Link href="/feed" className="btn">
              Volver al feed
            </Link>
          </div>
        )}
        {news && <Article news={news} reason={reasonFor(news, location)} />}
      </main>
    </>
  )
}

function Article({ news, reason }: { news: News; reason: string }) {
  const date = new Date(newsDate(news)).toLocaleString("es", { dateStyle: "long", timeStyle: "short" })
  const updated = news.updatedAt && news.updatedAt !== news.publishedAt ? new Date(news.updatedAt).toLocaleString("es", { dateStyle: "long", timeStyle: "short" }) : null
  const hasAiSource = news.sources.some((s) => s.type === "ai")
  const kicker = [SCOPE_LABEL[news.scope], news.region, news.country].filter(Boolean).join(" · ")

  return (
    <article className="article">
      <figure className="article-figure">
        <NewsImage news={news} className="article-media" />
        <figcaption>
          {news.image ? (
            <>
              <strong>{IMAGE_ORIGIN_LABEL[news.image.origin]}.</strong>{" "}
              {news.image.origin === "ai_generated" && "Ilustrativa: no es una foto del hecho. "}
              {news.image.attribution}
            </>
          ) : (
            <>Esta noticia no tiene imagen.</>
          )}
        </figcaption>
      </figure>

      <header className="article-head">
        <p className="article-kicker">{kicker}</p>
        <h1 className="article-title">{news.title}</h1>
        {news.summary && <p className="article-lead">{news.summary}</p>}
        <p className="article-date">
          <time dateTime={newsDate(news)}>Publicada el {date}</time>
          {updated && <> · Actualizada el {updated}</>}
        </p>
      </header>

      <section className={`validation-box validation-${news.validationStatus}`} aria-labelledby="h-validation">
        <div className="validation-box-head">
          <ValidationBadge status={news.validationStatus} />
          <h2 id="h-validation" className="visually-hidden">
            Estado de validación: {VALIDATION_LABEL[news.validationStatus]}
          </h2>
        </div>
        <p>{VALIDATION_HINT[news.validationStatus]}</p>
        {news.validationNote && (
          <p className="validation-note">
            <strong>Nota del equipo editorial:</strong> {news.validationNote}
          </p>
        )}
        <p className="validation-who">El estado lo decide una persona del equipo editorial, no la IA.</p>
      </section>

      <div className="article-body">
        {news.body.split(/\n{2,}/).map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>

      <section className="article-sources" aria-labelledby="h-sources">
        <h2 id="h-sources">Fuentes</h2>
        <ul>
          {news.sources.map((s, i) => (
            <li key={i}>
              <span className="article-source-name">
                {s.url ? (
                  <a href={s.url} target="_blank" rel="noopener noreferrer">
                    {s.name}
                    <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true">
                      <path d="M14 4h6v6M20 4l-9 9M18 14v5H5V6h5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </a>
                ) : (
                  s.name
                )}
              </span>
              <SourceTypeBadge type={s.type} />
            </li>
          ))}
        </ul>
        {hasAiSource && (
          <p className="article-ai-note">
            Parte de este contenido está marcado como <strong>generado por IA</strong>. Una respuesta de un modelo nunca
            cuenta como prueba de que algo sea verdad.
          </p>
        )}
      </section>

      <footer className="article-foot">
        {news.topics.length > 0 && (
          <p>
            <span className="muted">Temas:</span> {news.topics.join(" · ")}
          </p>
        )}
        <p className="card-reason">
          <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true">
            <path
              fill="currentColor"
              d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z"
            />
          </svg>
          <span>Por qué la ves: {reason}</span>
        </p>
      </footer>
    </article>
  )
}

// Compartir con la hoja nativa del celular; si no existe, copia el enlace.
function ShareButton({ news }: { news: News }) {
  const [copied, setCopied] = useState(false)

  async function share() {
    const url = window.location.href
    try {
      if (navigator.share) {
        await navigator.share({ title: news.title, text: news.summary, url })
      } else {
        await navigator.clipboard.writeText(url)
        setCopied(true)
        setTimeout(() => setCopied(false), 1800)
      }
    } catch {
      // El usuario canceló la hoja de compartir: no es un error.
    }
  }

  return (
    <button className="icon-btn" onClick={share} aria-label={copied ? "Enlace copiado" : "Compartir"}>
      {copied ? (
        <svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true">
          <path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true">
          <path d="M12 15V3M7.5 7.5L12 3l4.5 4.5M5 12v8h14v-8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  )
}

function ReaderSkeleton() {
  return (
    <div className="skeleton" aria-busy="true" aria-label="Cargando noticia">
      <div className="skeleton-block skeleton-hero" style={{ height: 220 }} />
      <div className="skeleton-block skeleton-line" />
      <div className="skeleton-block skeleton-line short" />
      <div className="skeleton-block skeleton-card" />
    </div>
  )
}
