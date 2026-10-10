"use client"

import Link from "next/link"
import { useLocation } from "@/lib/profile"
import { formatLocation } from "@/lib/locations"

// Muestra la ubicación simulada actual y lleva a cambiarla.
export function LocationChip() {
  const location = useLocation()
  return (
    <Link href="/ubicacion" className="location-chip" aria-label={`Ubicación simulada: ${formatLocation(location)}. Cambiar`}>
      <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill="currentColor"
          d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z"
        />
      </svg>
      <span>{formatLocation(location)}</span>
      <span className="location-chip-action">Cambiar</span>
    </Link>
  )
}
