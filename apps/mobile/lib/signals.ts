import { useEffect, useRef } from "react"
import { addDoc, collection, serverTimestamp } from "firebase/firestore"
import type { News } from "@respai/shared"
import { db } from "@/lib/firebase"
import type { UserLocation } from "@/lib/locations"

// Señales de comportamiento → users/{uid}/signals/{autoId}
// Las consume Rol 4 para inferir afinidad por tema. Estructura documentada en
// docs/senales.md. Reglas de Firestore: solo el propio usuario lee/escribe.
// Ninguna señal llama a un modelo; son escrituras simples.

export type SignalType = "open" | "read_time" | "share"

export type Signal = {
  type: SignalType
  newsId: string
  // Copia de datos de la noticia en ese momento, para que Rol 4 no tenga que
  // volver a leerla al calcular afinidades.
  topics: string[]
  scope: News["scope"]
  newsCountry: string | null
  newsRegion: string | null
  // Ubicación simulada del usuario cuando ocurrió la señal (nunca GPS).
  userLocation: UserLocation
  durationMs?: number // solo en read_time: tiempo con la noticia visible en pantalla
  shareMethod?: "native" | "copy" // solo en share
  createdAt: unknown // serverTimestamp()
  client: "mobile"
}

export const MIN_READ_MS = 2_000 // lecturas más cortas no se registran (toques accidentales)
export const MAX_READ_MS = 30 * 60_000 // tope: pantalla olvidada abierta

export function logSignal(
  uid: string,
  news: News,
  userLocation: UserLocation,
  type: SignalType,
  extra: Pick<Signal, "durationMs" | "shareMethod"> = {}
): void {
  const signal: Signal = {
    type,
    newsId: news.id,
    topics: news.topics,
    scope: news.scope,
    newsCountry: news.country ?? null,
    newsRegion: news.region ?? null,
    userLocation: { country: userLocation.country, region: userLocation.region },
    ...extra,
    createdAt: serverTimestamp(),
    client: "mobile",
  }
  // Fire-and-forget: una señal perdida no debe romper la lectura.
  addDoc(collection(db, "users", uid, "signals"), signal).catch((e) =>
    console.warn("No se pudo registrar la señal", type, e?.code ?? e)
  )
}

// Registra `open` una vez al abrir la noticia y `read_time` con el tiempo que
// estuvo VISIBLE en pantalla: se pausa si la app pasa a segundo plano y se
// guarda en ese momento (el celular puede cerrar la PWA sin avisar), y otra
// vez al salir del lector. Una misma apertura puede dejar varios read_time:
// Rol 4 los suma por newsId.
export function useReadSignals(news: News | null | undefined, uid: string, userLocation: UserLocation) {
  // En desarrollo React monta los efectos dos veces (StrictMode): este ref
  // evita registrar dos `open` por la misma apertura.
  const openedFor = useRef<string | null>(null)

  useEffect(() => {
    if (!news) return
    if (openedFor.current !== news.id) {
      openedFor.current = news.id
      logSignal(uid, news, userLocation, "open")
    }

    let visibleSince: number | null = document.visibilityState === "visible" ? Date.now() : null
    let accumulated = 0

    const flush = () => {
      if (visibleSince !== null) {
        accumulated += Date.now() - visibleSince
        visibleSince = null
      }
      if (accumulated >= MIN_READ_MS) {
        logSignal(uid, news, userLocation, "read_time", { durationMs: Math.min(accumulated, MAX_READ_MS) })
      }
      accumulated = 0
    }

    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush()
      else visibleSince = Date.now()
    }

    document.addEventListener("visibilitychange", onVisibility)
    return () => {
      document.removeEventListener("visibilitychange", onVisibility)
      flush()
    }
    // userLocation no cambia dentro del lector; se toma la del momento de abrir.
  }, [news, uid])
}
