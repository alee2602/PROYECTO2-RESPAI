"use client"

import { useEffect, useState } from "react"
import { doc, onSnapshot, type DocumentData } from "firebase/firestore"
import { db } from "@/lib/firebase"

// Lee UN documento en tiempo real y nunca lanza: los errores quedan como
// estado (solo el código, sin mensaje). Lo usa el tablero /costos.
export type DocState =
  | { status: "loading" }
  | { status: "missing" }
  | { status: "ok"; data: DocumentData }
  | { status: "denied" }
  | { status: "error"; code: string }

export function useDoc(path: string): DocState {
  // Se guarda junto con la ruta: si la ruta cambia (otra hora), se muestra
  // "cargando" hasta que llegue el documento nuevo.
  const [state, setState] = useState<{ path: string; value: DocState } | null>(null)

  useEffect(
    () =>
      onSnapshot(
        doc(db, path),
        (snap) => setState({ path, value: snap.exists() ? { status: "ok", data: snap.data() } : { status: "missing" } }),
        (e) =>
          setState({
            path,
            value: e.code === "permission-denied" ? { status: "denied" } : { status: "error", code: e.code ?? "desconocido" },
          })
      ),
    [path]
  )

  return state && state.path === path ? state.value : { status: "loading" }
}
