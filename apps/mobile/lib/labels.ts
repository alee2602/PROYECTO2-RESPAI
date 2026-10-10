import type { News } from "@respai/shared"

// Textos visibles en español para los valores del esquema (que están en inglés).

export const VALIDATION_LABEL: Record<News["validationStatus"], string> = {
  confirmed: "Confirmada",
  in_progress: "En desarrollo",
  unverified: "No verificada",
}

export const VALIDATION_HINT: Record<News["validationStatus"], string> = {
  confirmed: "Una persona del equipo editorial la verificó con fuentes suficientes.",
  in_progress: "La historia sigue abierta: faltan datos o hay fuentes que no coinciden.",
  unverified: "No se ha podido confirmar. Léela con cautela.",
}

export const SOURCE_TYPE_LABEL: Record<News["sources"][number]["type"], string> = {
  original: "Original",
  summary: "Resumen",
  ai: "Generado por IA",
}

export type ImageOrigin = NonNullable<News["image"]>["origin"]

export const IMAGE_ORIGIN_LABEL: Record<ImageOrigin, string> = {
  real_photo: "Foto real",
  free_attributed: "Imagen libre con atribución",
  ai_generated: "Imagen generada por IA",
}

export const SCOPE_LABEL: Record<News["scope"], string> = {
  local: "Local",
  national: "Nacional",
  international: "Internacional",
}

const rtf = new Intl.RelativeTimeFormat("es", { numeric: "auto" })

export function relativeTime(iso: string, now = Date.now()): string {
  const diff = (new Date(iso).getTime() - now) / 1000
  const abs = Math.abs(diff)
  if (abs < 60) return "hace un momento"
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute")
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour")
  if (abs < 86400 * 7) return rtf.format(Math.round(diff / 86400), "day")
  return new Date(iso).toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" })
}
