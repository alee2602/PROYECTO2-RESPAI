// Genera los mapas de puntos (dotted maps) que usa la app, a partir de
// lib/locations.ts, y copia las banderas SVG. Correr una vez (desde apps/mobile)
// y commitear lo generado:
//
//   node --experimental-strip-types scripts/generate-maps.mjs
//
// Salidas:
//   lib/maps.generated.ts  → puntos como paths SVG (se dibujan en línea, así
//                            toman los colores del tema claro/oscuro)
//   public/flags/*.svg      → banderas de `flag-icons` (MIT, lipis/flag-icons)
//
// Usa `dotted-map` (MIT, NTag/dotted-map) solo aquí: la app no carga ninguna
// librería de mapas en el celular.
import DottedMap from "dotted-map"
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { createRequire } from "node:module"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { LOCATIONS } from "../lib/locations.ts"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const r2 = (n) => Math.round(n * 100) / 100

// Codificación compacta: los puntos caen en una cuadrícula, así que se guarda
// por fila ("x*2" separados por coma, filas separadas por ";"). La app lo
// convierte en un solo <path> por capa (ver components/DotMap.tsx).
function encode(points, ystep) {
  const rows = []
  for (const p of points) {
    const row = Math.round(p.y / ystep)
    ;(rows[row] ??= []).push(Math.round(p.x * 2))
  }
  return Array.from(rows, (r) => (r ? r.sort((a, b) => a - b).join(",") : "")).join(";")
}

function build({ height, region, highlight, pins }) {
  const land = new DottedMap({ height, grid: "diagonal", region })
  const hi = new DottedMap({ height, grid: "diagonal", region, countries: highlight })
  const pinOut = {}
  for (const [key, { lat, lng }] of Object.entries(pins)) {
    land.addPin({ lat, lng, data: key })
  }
  for (const p of land.getPoints()) {
    if (p.data) pinOut[p.data] = { x: r2(p.x), y: r2(p.y) }
  }
  const landPoints = land.getPoints().filter((p) => !p.data)
  return {
    width: land.width,
    height: land.height,
    ystep: r2(land.ystep * 1000) / 1000,
    land: encode(landPoints, land.ystep),
    highlight: encode(hi.getPoints(), land.ystep),
    pins: pinOut,
  }
}

const countries = {}
for (const c of LOCATIONS) {
  countries[c.country] = build({
    height: 36,
    region: c.bbox,
    highlight: [c.iso3],
    pins: Object.fromEntries(c.regions.map((r) => [r.name, r])),
  })
}

// Mapa del mundo para el login, con los 5 países resaltados y un pin en la
// primera región de cada uno.
const world = build({
  height: 44,
  region: { lat: { min: -56, max: 74 }, lng: { min: -168, max: 180 } },
  highlight: LOCATIONS.map((c) => c.iso3),
  pins: Object.fromEntries(LOCATIONS.map((c) => [c.country, c.regions[0]])),
})

const out = `// GENERADO por scripts/generate-maps.mjs — no editar a mano.
// Mapas de puntos. Capas codificadas por fila: "x*2,x*2,...;..." (fila i →
// y = i * ystep). Se dibujan con components/DotMap.tsx. Coordenadas en
// unidades del viewBox (width × height).

export type DotMap = {
  width: number
  height: number
  ystep: number
  land: string
  highlight: string
  pins: Record<string, { x: number; y: number }>
}

export const COUNTRY_MAPS: Record<string, DotMap> = ${JSON.stringify(countries)}

export const WORLD_MAP: DotMap = ${JSON.stringify(world)}
`
writeFileSync(join(root, "lib/maps.generated.ts"), out)
console.log("ok lib/maps.generated.ts", (out.length / 1024).toFixed(1), "KB")

// Banderas
const require = createRequire(import.meta.url)
const flagsDir = join(dirname(require.resolve("flag-icons/package.json")), "flags/4x3")
mkdirSync(join(root, "public/flags"), { recursive: true })
for (const c of LOCATIONS) {
  copyFileSync(join(flagsDir, `${c.flag}.svg`), join(root, `public/flags/${c.flag}.svg`))
  console.log("ok public/flags/" + c.flag + ".svg")
}
writeFileSync(
  join(root, "public/flags/LICENSE.txt"),
  "Banderas de flag-icons (https://github.com/lipis/flag-icons), licencia MIT.\n\n" +
    readFileSync(join(dirname(flagsDir), "..", "LICENSE"), "utf8")
)
