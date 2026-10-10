"use client"

import { useEffect, useState } from "react"
import { AppHeader } from "@/components/AppHeader"
import { NewsCard } from "@/components/NewsCard"
import { fetchPublishedNews, type PublishedNews } from "@/lib/news"
import { rankFeed } from "@/lib/feed"
import { useLocation } from "@/lib/profile"

export default function FeedPage() {
  const location = useLocation()
  const [data, setData] = useState<PublishedNews | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    fetchPublishedNews()
      .then((d) => {
        if (!cancelled) {
          setData(d)
          setError(null)
        }
      })
      .catch((e) => !cancelled && setError(e.code ?? String(e)))
    return () => {
      cancelled = true
    }
  }, [reloadKey])

  // El orden depende de la ubicación simulada: al cambiarla, el feed se reordena.
  const items = data ? rankFeed(data.items, location) : []
  const hero = items.filter((i) => i.prominence === "hero")
  const large = items.filter((i) => i.prominence === "large")
  const normal = items.filter((i) => i.prominence === "normal")
  const compact = items.filter((i) => i.prominence === "compact")

  return (
    <>
      <AppHeader />
      <main className="feed">
        {error && (
          <div className="state-box" role="alert">
            <p className="error">No se pudieron cargar las noticias ({error}).</p>
            <button className="btn" onClick={() => setReloadKey((k) => k + 1)}>
              Reintentar
            </button>
          </div>
        )}

        {!data && !error && <FeedSkeleton />}

        {data && items.length === 0 && (
          <div className="state-box">
            <p>Todavía no hay noticias publicadas.</p>
          </div>
        )}

        {items.length > 0 && (
          <>
            <div className="feed-top">
              <section aria-label="Noticia principal" className="feed-hero">
                {hero.map((i) => (
                  <NewsCard key={i.news.id} item={i} rank={1} />
                ))}
              </section>

              {large.length > 0 && (
                <section aria-label="Destacadas" className="feed-grid feed-grid-large">
                  {large.map((i) => (
                    <NewsCard key={i.news.id} item={i} rank={items.indexOf(i) + 1} />
                  ))}
                </section>
              )}
            </div>

            {normal.length > 0 && (
              <section aria-labelledby="h-normal" className="feed-section">
                <h2 id="h-normal" className="section-title">
                  También para ti
                </h2>
                <div className="feed-grid feed-grid-normal">
                  {normal.map((i) => (
                    <NewsCard key={i.news.id} item={i} rank={items.indexOf(i) + 1} />
                  ))}
                </div>
              </section>
            )}

            {compact.length > 0 && (
              <section aria-labelledby="h-compact" className="feed-section">
                <h2 id="h-compact" className="section-title">
                  Más noticias
                </h2>
                <div className="feed-list">
                  {compact.map((i) => (
                    <NewsCard key={i.news.id} item={i} rank={items.indexOf(i) + 1} />
                  ))}
                </div>
              </section>
            )}

            <footer className="feed-footnote">
              <p>
                <strong>Cómo se ordena este feed:</strong> primero lo más cercano a tu ubicación simulada y lo más
                reciente. No se esconde ninguna noticia: las de otros países y alcances siguen aquí abajo. Orden
                provisional sin IA, mientras se integra el ranking del equipo.
              </p>
              {data && data.hidden > 0 && (
                <p>
                  {data.hidden === 1 ? "1 noticia no se muestra" : `${data.hidden} noticias no se muestran`} porque no
                  tiene{data.hidden === 1 ? "" : "n"} estado de validación o fuente registrada.
                </p>
              )}
              <button className="btn btn-ghost" onClick={() => setReloadKey((k) => k + 1)}>
                Actualizar noticias
              </button>
            </footer>
          </>
        )}
      </main>
    </>
  )
}

function FeedSkeleton() {
  return (
    <div className="skeleton" aria-busy="true" aria-label="Cargando noticias">
      <div className="skeleton-block skeleton-hero" />
      <div className="skeleton-block skeleton-line" />
      <div className="skeleton-block skeleton-line short" />
      <div className="skeleton-block skeleton-card" />
      <div className="skeleton-block skeleton-card" />
    </div>
  )
}
