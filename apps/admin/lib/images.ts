import type { News } from "@respai/shared"

// Imágenes para noticias sin foto. Se prefieren imágenes libres con
// atribución (Openverse, que indexa Wikimedia Commons, Flickr y otros, sin
// API key ni costo). El portal no genera imágenes con IA; si alguien trae una,
// se marca su origen y la app muestra la etiqueta.

export type ImageOrigin = NonNullable<News["image"]>["origin"]

export const IMAGE_ORIGIN_LABEL: Record<ImageOrigin, string> = {
  real_photo: "Foto real del hecho",
  free_attributed: "Imagen libre con atribución",
  ai_generated: "Imagen generada por IA",
}

// Una imagen libre casi nunca es del hecho (es una foto genérica del lugar o
// del tema), así que la atribución lo dice primero: la app la muestra tal cual.
export const ILLUSTRATIVE_PREFIX = "Imagen ilustrativa (no es del hecho):"

export type ImageResult = {
  id: string
  title: string
  url: string
  thumbnail: string
  creator: string
  license: string // "CC BY 2.0", "CC0", "Dominio público"
  landingUrl: string // página original de la imagen
  source: string // "Wikimedia Commons", "Flickr"…
}

const SOURCE_NAME: Record<string, string> = {
  wikimedia: "Wikimedia Commons",
  flickr: "Flickr",
  nappy: "Nappy",
  rawpixel: "rawpixel",
  stocksnap: "StockSnap",
}

export function licenseLabel(license: string, version?: string | null): string {
  const l = license.toLowerCase()
  if (l === "cc0") return "CC0"
  if (l === "pdm") return "Dominio público"
  return `CC ${l.toUpperCase()}${version ? ` ${version}` : ""}`
}

export function openverseSearchUrl(query: string): string {
  const params = new URLSearchParams({ q: query.trim(), page_size: "12", mature: "false" })
  return `https://api.openverse.org/v1/images/?${params}`
}

// Respuesta de la API de Openverse → resultados utilizables. Se descartan los
// que no traen URL o licencia (sin licencia no se puede atribuir).
export function parseOpenverse(json: unknown): ImageResult[] {
  const results = (json as { results?: unknown })?.results
  if (!Array.isArray(results)) return []
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "")
  return results.flatMap((r: Record<string, unknown>) => {
    const url = str(r.url)
    const license = str(r.license)
    if (!url.startsWith("https://") || !license) return []
    const source = str(r.source) || str(r.provider)
    return [
      {
        id: str(r.id) || url,
        title: str(r.title) || "Sin título",
        url,
        thumbnail: str(r.thumbnail) || url,
        creator: str(r.creator),
        license: licenseLabel(license, str(r.license_version) || null),
        landingUrl: str(r.foreign_landing_url),
        source: SOURCE_NAME[source] ?? source,
      },
    ]
  })
}

export function attributionFor(r: ImageResult): string {
  const by = r.creator ? `, de ${r.creator}` : ""
  const via = r.source ? `, vía ${r.source}` : ""
  const link = r.landingUrl ? ` ${r.landingUrl}` : ""
  return `${ILLUSTRATIVE_PREFIX} "${r.title}"${by} (${r.license})${via}.${link}`
}
