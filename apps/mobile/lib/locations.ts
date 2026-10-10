// Ubicaciones simuladas que el usuario puede elegir. La personalización usa
// SOLO esto, nunca el GPS ni la IP (CLAUDE.md, sección 2.3).
//
// Los textos `country` y `regions[].name` tienen que coincidir EXACTAMENTE con
// los campos `country` y `region` de las noticias (ver
// scripts/seed-news/README.md), porque el feed los compara tal cual. Si el
// portal (Rol 3) usa otros textos, hay que alinearlos aquí.
//
// Datos solo visuales (no se guardan en Firestore):
// - `flag`: código ISO de 2 letras → public/flags/{flag}.svg
// - `iso3`, `bbox`, `regions[].lat/lng`: para dibujar el mapa de puntos. Son
//   coordenadas fijas escritas a mano (la capital de cada región), NO la
//   ubicación del teléfono. Si se cambian, regenerar los mapas:
//   node --experimental-strip-types scripts/generate-maps.mjs

export type UserLocation = {
  country: string
  region: string | null // null = "todo el país" (Firestore no acepta undefined)
}

export type CountryDef = {
  country: string
  flag: string
  iso3: string
  bbox: { lat: { min: number; max: number }; lng: { min: number; max: number } }
  regions: { name: string; lat: number; lng: number }[]
}

export const LOCATIONS: CountryDef[] = [
  {
    country: "Guatemala",
    flag: "gt",
    iso3: "GTM",
    bbox: { lat: { min: 13.2, max: 18.2 }, lng: { min: -92.8, max: -88 } },
    regions: [
      { name: "Ciudad de Guatemala", lat: 14.63, lng: -90.51 },
      { name: "Sacatepéquez", lat: 14.56, lng: -90.73 },
      { name: "Quetzaltenango", lat: 14.84, lng: -91.52 },
      { name: "Petén", lat: 16.93, lng: -89.89 },
    ],
  },
  {
    country: "México",
    flag: "mx",
    iso3: "MEX",
    bbox: { lat: { min: 14, max: 33 }, lng: { min: -118, max: -86 } },
    regions: [
      { name: "Ciudad de México", lat: 19.43, lng: -99.13 },
      { name: "Jalisco", lat: 20.66, lng: -103.35 },
    ],
  },
  {
    country: "España",
    flag: "es",
    iso3: "ESP",
    bbox: { lat: { min: 35.6, max: 44 }, lng: { min: -9.8, max: 4.5 } },
    regions: [
      { name: "Madrid", lat: 40.42, lng: -3.7 },
      { name: "Andalucía", lat: 37.39, lng: -5.98 },
    ],
  },
  {
    country: "Estados Unidos",
    flag: "us",
    iso3: "USA",
    bbox: { lat: { min: 24, max: 50 }, lng: { min: -125, max: -66 } },
    regions: [
      { name: "California", lat: 36.78, lng: -119.42 },
      { name: "Nueva York", lat: 40.71, lng: -74.0 },
    ],
  },
  {
    country: "Argentina",
    flag: "ar",
    iso3: "ARG",
    bbox: { lat: { min: -55.5, max: -21 }, lng: { min: -74, max: -53 } },
    regions: [
      { name: "Buenos Aires", lat: -34.6, lng: -58.38 },
      { name: "Córdoba", lat: -31.42, lng: -64.18 },
    ],
  },
]

export function formatLocation(loc: UserLocation): string {
  return loc.region ? `${loc.region}, ${loc.country}` : loc.country
}

export function findCountry(country: string): CountryDef | undefined {
  return LOCATIONS.find((l) => l.country === country)
}

// Valida lo que viene de Firestore (users/{uid}.location) antes de usarlo.
export function parseLocation(raw: unknown): UserLocation | null {
  if (!raw || typeof raw !== "object") return null
  const { country, region } = raw as { country?: unknown; region?: unknown }
  if (typeof country !== "string" || !country) return null
  return { country, region: typeof region === "string" && region ? region : null }
}
