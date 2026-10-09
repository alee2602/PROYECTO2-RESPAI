// Contrato compartido entre portal, feed y chat.
// Cualquier cambio aquí se avisa al equipo antes de hacerse (ver docs/roles-equipo.md, regla 2).
//
// Nombres de campos en inglés (código); la documentación del proyecto
// (CLAUDE.md, docs/roles-equipo.md) describe los mismos campos en español.
// Mapeo: titulo→title, resumen→summary, cuerpo→body, fuentes→sources,
// estadoValidacion→validationStatus, notaValidacion→validationNote,
// alcance→scope, pais→country, temas→topics, imagen→image,
// creadaEn→createdAt, publicadaEn→publishedAt, actualizadaEn→updatedAt.

export type News = {
  id: string
  title: string
  summary: string
  body: string

  // Provenance
  sources: { name: string; url?: string; type: 'original' | 'summary' | 'ai' }[]
  authorId: string // who published it from the portal

  // Validation — the status is decided by a person in the portal, never the model or the code.
  validationStatus: 'confirmed' | 'in_progress' | 'unverified'
  validationNote?: string // why it has that status, what's missing, contradictions

  // Geographic scope (for relevance)
  scope: 'local' | 'national' | 'international'
  country?: string
  region?: string
  topics: string[]

  // Image
  image?: {
    url: string
    origin: 'real_photo' | 'free_attributed' | 'ai_generated'
    attribution?: string
  }

  // Dates
  createdAt: string
  publishedAt?: string
  updatedAt?: string
}

// No explicit "importance" field: prominence is computed in the feed
// per user and context (Etapa 3), not stored on the news item.
