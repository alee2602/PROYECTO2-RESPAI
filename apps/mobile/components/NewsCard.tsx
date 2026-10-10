import Link from "next/link"
import type { FeedItem } from "@/lib/feed"
import { newsDate } from "@/lib/news"
import { relativeTime, SCOPE_LABEL } from "@/lib/labels"
import { SourceLine, ValidationBadge } from "@/components/Badges"
import { NewsImage } from "@/components/NewsImage"

// Tarjeta del feed. La variante (hero / large / normal / compact) viene de la
// prominencia del FeedItem. Toda tarjeta muestra SIEMPRE: estado de
// validación, procedencia (primera fuente + tipo) y por qué aparece.
export function NewsCard({ item, rank }: { item: FeedItem; rank: number }) {
  const { news, prominence, reason, protectedByDiversity } = item
  const kicker = [SCOPE_LABEL[news.scope], news.region ?? news.country].filter(Boolean).join(" · ")
  const showImage = prominence !== "compact"
  const showSummary = prominence === "hero" || prominence === "large"

  return (
    <article className={`card card-${prominence}`}>
      <Link href={`/noticia/${news.id}`} className="card-link">
        {prominence === "compact" && (
          <span className="card-rank" aria-hidden="true">
            {String(rank).padStart(2, "0")}
          </span>
        )}
        {showImage && <NewsImage news={news} className="card-media" />}
        <div className="card-body">
          <div className="card-meta">
            <ValidationBadge status={news.validationStatus} size={prominence === "compact" ? "sm" : "md"} />
            <span className="card-kicker">{kicker}</span>
          </div>
          <h2 className="card-title">{news.title}</h2>
          {showSummary && news.summary && <p className="card-summary">{news.summary}</p>}
          <div className="card-foot">
            <SourceLine sources={news.sources} />
            <time dateTime={newsDate(news)} className="card-time">
              {relativeTime(newsDate(news))}
            </time>
          </div>
          <p className="card-reason">
            <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true">
              <path
                fill="currentColor"
                d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z"
              />
            </svg>
            <span>
              <span className="visually-hidden">Por qué la ves: </span>
              {reason}
              {protectedByDiversity && " · para que no te pierdas lo importante"}
            </span>
          </p>
        </div>
      </Link>
    </article>
  )
}
