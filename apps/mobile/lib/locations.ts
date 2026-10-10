// Ubicaciones simuladas que el usuario puede elegir. La personalización usa
// SOLO esto, nunca el GPS (CLAUDE.md, sección 2.3).
//
// Los textos tienen que coincidir EXACTAMENTE con los campos `country` y
// `region` de las noticias (ver scripts/seed-news/README.md), porque el feed
// los compara tal cual. Si el portal (Rol 3) usa otros textos, hay que
// alinearlos aquí.

export type UserLocation = {
  country: string
  region: string | null // null = "todo el país" (Firestore no acepta undefined)
}

export const LOCATIONS: { country: string; regions: string[] }[] = [
  {
    country: "Guatemala",
    regions: ["Ciudad de Guatemala", "Sacatepéquez", "Quetzaltenango", "Petén"],
  },
  { country: "México", regions: ["Ciudad de México", "Jalisco"] },
  { country: "España", regions: ["Madrid", "Andalucía"] },
  { country: "Estados Unidos", regions: ["California", "Nueva York"] },
  { country: "Argentina", regions: ["Buenos Aires", "Córdoba"] },
]

export function formatLocation(loc: UserLocation): string {
  return loc.region ? `${loc.region}, ${loc.country}` : loc.country
}

// Valida lo que viene de Firestore (users/{uid}.location) antes de usarlo.
export function parseLocation(raw: unknown): UserLocation | null {
  if (!raw || typeof raw !== "object") return null
  const { country, region } = raw as { country?: unknown; region?: unknown }
  if (typeof country !== "string" || !country) return null
  return { country, region: typeof region === "string" && region ? region : null }
}
