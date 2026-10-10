// Países y regiones del proyecto: los mismos textos que el usuario elige como
// ubicación simulada en la app y que el portal guarda en `country` / `region`
// de cada noticia. El feed los compara tal cual, así que un texto distinto
// ("Quetzaltenago") hace que la noticia no le aparezca a nadie de esa región.
//
// Fuente única para portal y app. Los datos visuales de la app (bandera,
// coordenadas del mapa) siguen en apps/mobile/lib/locations.ts y deben usar
// exactamente estos nombres.

export type LocationDef = {
  country: string
  regions: string[]
}

export const LOCATIONS_LIST: LocationDef[] = [
  { country: "Guatemala", regions: ["Ciudad de Guatemala", "Sacatepéquez", "Quetzaltenango", "Petén"] },
  { country: "México", regions: ["Ciudad de México", "Jalisco"] },
  { country: "España", regions: ["Madrid", "Andalucía"] },
  { country: "Estados Unidos", regions: ["California", "Nueva York"] },
  { country: "Argentina", regions: ["Buenos Aires", "Córdoba"] },
]
