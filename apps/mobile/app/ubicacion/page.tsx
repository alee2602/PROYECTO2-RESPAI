"use client"

import { useRouter } from "next/navigation"
import { LocationPicker } from "@/components/LocationPicker"
import { TopBar } from "@/components/TopBar"

export default function UbicacionPage() {
  const router = useRouter()
  return (
    <>
      <TopBar title="Ubicación" />
      <main className="screen screen-under-bar">
        <LocationPicker onSaved={() => router.push("/feed")} />
      </main>
    </>
  )
}
