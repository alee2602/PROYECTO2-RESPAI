"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { LocationPicker } from "@/components/LocationPicker"

export default function UbicacionPage() {
  const router = useRouter()
  return (
    <main className="screen">
      <Link href="/" className="back-link">
        ← Volver
      </Link>
      <LocationPicker onSaved={() => router.push("/")} />
    </main>
  )
}
