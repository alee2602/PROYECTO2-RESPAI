"use client"

import { useState } from "react"
import {
  attributionFor,
  IMAGE_ORIGIN_LABEL,
  openverseSearchUrl,
  parseOpenverse,
  type ImageOrigin,
  type ImageResult,
} from "@/lib/images"
import type { DraftImage } from "@/lib/newsDraft"

const ORIGIN_HINT: Record<ImageOrigin, string> = {
  free_attributed: "Creative Commons o dominio público. Casi siempre es ilustrativa: no muestra el hecho.",
  real_photo: "Foto del hecho, publicada por una de las fuentes. Pon el crédito (ej. Foto: AGN).",
  ai_generated:
    "El portal no genera imágenes. Si traes una hecha con IA, la app la etiqueta y aclara que no es una foto del hecho.",
}

type Search = { status: "idle" | "loading" | "done" | "error"; results: ImageResult[]; message?: string }

// Imagen de la noticia: buscar una imagen libre (Openverse, $0) o pegar una
// URL. Siempre con origen y atribución.
export function ImagePicker({
  image,
  title,
  onChange,
}: {
  image: DraftImage | null
  title: string
  onChange: (image: DraftImage | null) => void
}) {
  const [query, setQuery] = useState("")
  const [search, setSearch] = useState<Search>({ status: "idle", results: [] })

  async function runSearch() {
    const q = (query || title).trim()
    if (!q) return
    setQuery(q)
    setSearch({ status: "loading", results: [] })
    try {
      const res = await fetch(openverseSearchUrl(q))
      if (res.status === 429)
        return setSearch({
          status: "error",
          results: [],
          message: "Openverse limita las búsquedas (20 por minuto, 200 al día). Espera un momento o pega una URL.",
        })
      if (!res.ok) throw new Error(String(res.status))
      const results = parseOpenverse(await res.json())
      setSearch({
        status: "done",
        results,
        message: results.length ? undefined : "Sin resultados. Prueba con menos palabras o en inglés (ej. volcano Guatemala).",
      })
    } catch (e) {
      setSearch({ status: "error", results: [], message: `No se pudo buscar en Openverse (${String(e)}).` })
    }
  }

  if (image) {
    const set = (patch: Partial<DraftImage>) => onChange({ ...image, ...patch })
    return (
      <div className="image-picker">
        <div className="image-current">
          {image.url.startsWith("https://") ? (
            <img src={image.url} alt="Imagen elegida" />
          ) : (
            <div className="image-empty muted small">Pega una URL https:// para ver la imagen</div>
          )}
          <div className="image-fields">
            <label className="field">
              <span>URL de la imagen</span>
              <input type="url" value={image.url} onChange={(e) => set({ url: e.target.value })} placeholder="https://…" />
            </label>
            <label className="field">
              <span>Origen</span>
              <select value={image.origin} onChange={(e) => set({ origin: e.target.value as ImageOrigin })}>
                {(Object.keys(IMAGE_ORIGIN_LABEL) as ImageOrigin[]).map((o) => (
                  <option key={o} value={o}>
                    {IMAGE_ORIGIN_LABEL[o]}
                  </option>
                ))}
              </select>
              <span className="muted small">{ORIGIN_HINT[image.origin]}</span>
            </label>
            <label className="field">
              <span>Atribución</span>
              <span className="muted small">Autor, licencia y de dónde se obtuvo. La app la muestra junto a la imagen.</span>
              <textarea rows={3} value={image.attribution} onChange={(e) => set({ attribution: e.target.value })} />
            </label>
            <div>
              <button type="button" className="btn btn-sm" onClick={() => onChange(null)}>
                Quitar imagen
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="image-picker">
      <p className="muted small">
        Esta noticia no tiene imagen: la app muestra un bloque gráfico con el tema, que no se confunde con una foto. Si
        quieres una, prefiere una imagen libre con atribución.
      </p>
      <div className="image-search">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              runSearch()
            }
          }}
          placeholder={title ? `Ej. ${title.split(" ").slice(0, 4).join(" ")}` : "Palabras clave (lugar, tema)"}
          aria-label="Buscar imagen libre"
        />
        <button type="button" className="btn btn-sm" onClick={runSearch} disabled={search.status === "loading"}>
          {search.status === "loading" ? "Buscando…" : "Buscar imagen libre"}
        </button>
        <button
          type="button"
          className="btn btn-sm"
          onClick={() => onChange({ url: "", origin: "real_photo", attribution: "" })}
        >
          Pegar URL
        </button>
      </div>
      <span className="muted small">
        Busca en Openverse (Wikimedia Commons, Flickr y otros), solo imágenes con licencia libre. Sin costo.
      </span>
      {search.message && <p className={search.status === "error" ? "error small" : "muted small"}>{search.message}</p>}
      {search.results.length > 0 && (
        <ul className="image-results">
          {search.results.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => onChange({ url: r.url, origin: "free_attributed", attribution: attributionFor(r) })}
                title={`Usar "${r.title}"`}
              >
                <img src={r.thumbnail} alt={r.title} loading="lazy" />
                <span className="small">{r.title}</span>
                <span className="muted small">
                  {r.license}
                  {r.creator && ` · ${r.creator}`}
                  {r.source && ` · ${r.source}`}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
