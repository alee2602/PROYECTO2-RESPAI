import type { DotMap as DotMapData } from "@/lib/maps.generated"

// Dibuja un mapa de puntos generado por scripts/generate-maps.mjs.
// - Capa "land": tierra de la zona (gris claro).
// - Capa "highlight": el/los país(es) resaltados.
// - Pines: `active` lleva un marcador tipo gota; `dots` son puntos pequeños.
// Los colores salen de CSS (.dotmap-*), así que funciona en modo claro y oscuro.

const pathCache = new Map<string, string>()

function decode(encoded: string, ystep: number): string {
  const hit = pathCache.get(encoded)
  if (hit) return hit
  let d = ""
  encoded.split(";").forEach((row, i) => {
    if (!row) return
    const y = Math.round(i * ystep * 100) / 100
    for (const x2 of row.split(",")) d += `M${Number(x2) / 2} ${y}h0`
  })
  pathCache.set(encoded, d)
  return d
}

export function DotMap({
  map,
  active,
  dots = [],
  label,
  className = "",
}: {
  map: DotMapData
  active?: string | null
  dots?: string[]
  label: string
  className?: string
}) {
  const pin = active ? map.pins[active] : undefined
  return (
    <svg
      className={`dotmap ${className}`}
      viewBox={`-1 -2 ${map.width + 2} ${map.height + 3}`}
      role="img"
      aria-label={label}
      preserveAspectRatio="xMidYMid meet"
    >
      <path className="dotmap-land" d={decode(map.land, map.ystep)} />
      <path className="dotmap-highlight" d={decode(map.highlight, map.ystep)} />
      {dots.map((k) => {
        const p = map.pins[k]
        return p ? <circle key={k} className="dotmap-dot" cx={p.x} cy={p.y} r={0.95} /> : null
      })}
      {pin && (
        <g key={active} className="dotmap-pin" transform={`translate(${pin.x} ${pin.y})`}>
          <circle className="dotmap-pin-pulse" r={1.4} />
          <ellipse className="dotmap-pin-shadow" cx={0} cy={0.1} rx={0.9} ry={0.35} />
          {/* Gota: la punta queda exactamente sobre la región */}
          <path
            className="dotmap-pin-drop"
            d="M0 0C-0.55 -1 -1.6 -1.9 -1.6 -3.1A1.6 1.6 0 0 1 1.6 -3.1C1.6 -1.9 0.55 -1 0 0Z"
          />
          <circle className="dotmap-pin-hole" cx={0} cy={-3.1} r={0.58} />
        </g>
      )}
    </svg>
  )
}

export function Flag({ code, className = "" }: { code: string; className?: string }) {
  // Banderas SVG de flag-icons (MIT), copiadas a public/flags por el script de mapas.
  return <img className={`flag ${className}`} src={`/flags/${code}.svg`} alt="" width={28} height={21} loading="lazy" />
}
