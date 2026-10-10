import { hostOf } from "./newsDraft.ts"

// Medios de referencia para buscar si otros medios también reportan una
// noticia. Es un punto de partida del equipo, no una certificación: que una
// fuente sea de esta lista NO la vuelve verdadera, solo ayuda a encontrar y
// reconocer medios con trayectoria. Cambiarla es decisión del equipo.

export type Outlet = { name: string; domain: string }

const BY_COUNTRY: Record<string, Outlet[]> = {
  Guatemala: [
    { name: "Prensa Libre", domain: "prensalibre.com" },
    { name: "AGN", domain: "agn.gt" },
    { name: "República", domain: "republica.gt" },
    { name: "Plaza Pública", domain: "plazapublica.com.gt" },
    { name: "La Hora", domain: "lahora.gt" },
    { name: "Soy502", domain: "soy502.com" },
  ],
  México: [
    { name: "El Universal", domain: "eluniversal.com.mx" },
    { name: "Animal Político", domain: "animalpolitico.com" },
    { name: "Milenio", domain: "milenio.com" },
    { name: "El Financiero", domain: "elfinanciero.com.mx" },
  ],
  España: [
    { name: "El País", domain: "elpais.com" },
    { name: "RTVE", domain: "rtve.es" },
    { name: "El Mundo", domain: "elmundo.es" },
    { name: "La Vanguardia", domain: "lavanguardia.com" },
  ],
  "Estados Unidos": [
    { name: "NPR", domain: "npr.org" },
    { name: "The New York Times", domain: "nytimes.com" },
  ],
  Argentina: [
    { name: "La Nación", domain: "lanacion.com.ar" },
    { name: "Clarín", domain: "clarin.com" },
    { name: "Infobae", domain: "infobae.com" },
  ],
}

// Agencias y medios internacionales: se suman a la búsqueda de cualquier país.
const INTERNATIONAL: Outlet[] = [
  { name: "Reuters", domain: "reuters.com" },
  { name: "AP", domain: "apnews.com" },
  { name: "AFP", domain: "afp.com" },
  { name: "EFE", domain: "efe.com" },
  { name: "BBC Mundo", domain: "bbc.com" },
  { name: "DW", domain: "dw.com" },
]

export function outletsFor(country: string): Outlet[] {
  return [...(BY_COUNTRY[country.trim()] ?? []), ...INTERNATIONAL]
}

// Medio de la lista al que pertenece la URL de una fuente, también por
// subdominio (www.bbc.com/mundo y mundo.bbc.com → BBC Mundo).
export function knownOutlet(url: string): Outlet | null {
  const host = hostOf(url)
  if (!host) return null
  const all = [...Object.values(BY_COUNTRY).flat(), ...INTERNATIONAL]
  return all.find((o) => host === o.domain || host.endsWith(`.${o.domain}`)) ?? null
}

// Enlace a Google Noticias con el título de la noticia. Con `outlets`, la
// búsqueda se limita a esos medios. Se abre en otra pestaña y la persona lee:
// el portal no consulta nada por su cuenta ni guarda el resultado.
export function newsSearchUrl(title: string, outlets?: Outlet[]): string {
  const sites = outlets?.length ? ` (${outlets.map((o) => `site:${o.domain}`).join(" OR ")})` : ""
  const q = `${title.trim()}${sites}`
  return `https://news.google.com/search?q=${encodeURIComponent(q)}&hl=es-419&gl=US&ceid=US:es-419`
}
