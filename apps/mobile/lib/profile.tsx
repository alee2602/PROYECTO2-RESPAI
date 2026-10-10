"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useUser } from "@/lib/auth"
import { parseLocation, type UserLocation } from "@/lib/locations"

// Perfil del usuario en Firestore: users/{uid}. Las reglas solo dejan que el
// propio dueño lo lea y escriba.
//
// Estructura que escribe la app (Rol 1):
//   users/{uid} = {
//     location: { country: string, region: string | null },
//     locationUpdatedAt: Timestamp,
//   }
// Otros campos (por ejemplo intereses inferidos por Rol 4) se pueden agregar
// sin chocar: siempre escribimos con { merge: true }.

type ProfileState = {
  // undefined = todavía cargando; null = el usuario no ha elegido ubicación
  location: UserLocation | null | undefined
  error: string | null
  saveLocation: (loc: UserLocation) => Promise<void>
}

const ProfileContext = createContext<ProfileState | null>(null)

export function ProfileProvider({ children }: { children: ReactNode }) {
  const user = useUser()
  const [location, setLocation] = useState<UserLocation | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)

  useEffect(
    () =>
      onSnapshot(
        doc(db, "users", user.uid),
        (snap) => {
          setLocation(parseLocation(snap.data()?.location))
          setError(null)
        },
        (e) => setError(e.code ?? String(e))
      ),
    [user.uid]
  )

  async function saveLocation(loc: UserLocation) {
    await setDoc(
      doc(db, "users", user.uid),
      { location: { country: loc.country, region: loc.region }, locationUpdatedAt: serverTimestamp() },
      { merge: true }
    )
  }

  return <ProfileContext value={{ location, error, saveLocation }}>{children}</ProfileContext>
}

export function useProfile() {
  const ctx = useContext(ProfileContext)
  if (!ctx) throw new Error("useProfile debe usarse dentro de <ProfileProvider>")
  return ctx
}

// Para pantallas detrás de <LocationGate>: ahí la ubicación siempre existe.
export function useLocation(): UserLocation {
  const { location } = useProfile()
  if (!location) throw new Error("useLocation solo funciona detrás de <LocationGate>")
  return location
}
