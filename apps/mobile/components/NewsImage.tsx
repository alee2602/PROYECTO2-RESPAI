import type { CSSProperties } from "react"
import type { News } from "@respai/shared"
import { AiImageLabel } from "@/components/Badges"

// Imagen de una noticia. Reglas (CLAUDE.md sección 3, "Imágenes"):
// - Si fue generada por IA, la etiqueta va SIEMPRE encima, visible.
// - Si no hay imagen, se muestra un bloque gráfico con el tema, que no puede
//   confundirse con una foto del hecho.
export function NewsImage({ news, className = "" }: { news: News; className?: string }) {
  const img = news.image
  if (!img) {
    const topic = news.topics[0] ?? "noticia"
    return (
      <div className={`news-media media-placeholder ${className}`} style={{ "--hue": hueFor(topic) } as CSSProperties}>
        <span className="media-placeholder-topic">{topic}</span>
        <span className="media-placeholder-note">Sin imagen</span>
      </div>
    )
  }
  return (
    <div className={`news-media ${className}`}>
      <img src={img.url} alt="" loading="lazy" decoding="async" />
      {img.origin === "ai_generated" && <AiImageLabel />}
    </div>
  )
}

// Tono estable por tema, para que cada tema tenga "su" color.
function hueFor(text: string): number {
  let h = 0
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) % 360
  return h
}
