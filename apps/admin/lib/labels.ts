import type { News } from "@respai/shared"

// Textos en español para mostrar los valores del esquema en el portal.

export const STATUS_LABEL: Record<News["validationStatus"], string> = {
  confirmed: "Confirmada",
  in_progress: "En desarrollo",
  unverified: "No verificada",
}

export const SCOPE_LABEL: Record<News["scope"], string> = {
  local: "Local",
  national: "Nacional",
  international: "Internacional",
}
