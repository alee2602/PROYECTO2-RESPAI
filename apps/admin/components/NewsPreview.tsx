"use client"

import { IMAGE_ORIGIN_LABEL } from "@/lib/images"
import { SCOPE_LABEL, STATUS_LABEL } from "@/lib/labels"
import type { NewsDraft } from "@/lib/newsDraft"

const SOURCE_TYPE_LABEL = { original: "Original", summary: "Resumen", ai: "Generado por IA" } as const

// Aproximación de la tarjeta y el pie de imagen que muestra la app (Rol 1),
// para revisar antes de publicar qué verá el lector. El diseño final lo
// define la app.
export function NewsPreview({ draft }: { draft: NewsDraft }) {
  const topic = draft.topics.split(",")[0]?.trim() || "noticia"
  const source = draft.sources.find((s) => s.name.trim())
  const place = draft.scope === "international" ? draft.country : draft.region || draft.country
  const image = draft.image?.url.startsWith("https://") ? draft.image : null

  return (
    <div className="preview">
      <article className="preview-card">
        <div className="preview-media">
          {image ? (
            <>
              <img src={image.url} alt="" />
              {image.origin === "ai_generated" && <span className="preview-ai-label">Imagen generada por IA</span>}
            </>
          ) : (
            <div className="preview-placeholder">
              <strong>{topic.toUpperCase()}</strong>
              <span>Sin imagen</span>
            </div>
          )}
        </div>
        <div className="preview-body">
          <div className="news-row-tags">
            <span className={`chip ${draft.validationStatus}`}>{STATUS_LABEL[draft.validationStatus]}</span>
            <span className="chip">
              {SCOPE_LABEL[draft.scope]}
              {place && ` · ${place}`}
            </span>
          </div>
          <h3>{draft.title || "(sin título)"}</h3>
          <p className="muted small">{draft.summary || "(sin resumen)"}</p>
          {source && (
            <p className="small">
              {source.name.trim()} <span className="chip">{SOURCE_TYPE_LABEL[source.type]}</span>
            </p>
          )}
        </div>
      </article>
      <p className="muted small">
        Pie de imagen en el lector:{" "}
        {image ? (
          <>
            <strong>{IMAGE_ORIGIN_LABEL[image.origin]}.</strong>{" "}
            {image.origin === "ai_generated" && "Ilustrativa: no es una foto del hecho. "}
            {image.attribution}
          </>
        ) : (
          "Esta noticia no tiene imagen."
        )}
      </p>
    </div>
  )
}
