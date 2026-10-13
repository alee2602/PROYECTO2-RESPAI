import { doc, getDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"

// La lista de correos admin NO vive en el código (ver docs/ciclos.md,
// 2026-10-12: antes estaba hardcodeada aquí y en firestore.rules — correos
// de compañeros quedaban en el repo sin necesidad). Ahora vive como DATOS en
// Firestore: la colección `admins`, donde el ID del documento es el correo.
//
// Esta función solo decide qué PANTALLA ve la persona (UX). La seguridad
// real la ponen las reglas de Firestore (isAdmin() en /firestore.rules),
// que usan exactamente el mismo criterio — aunque alguien se saltara esta
// pantalla, el servidor rechaza cualquier escritura en `news` igual.
//
// Para agregar o quitar un admin: Firebase Console → Firestore Database →
// Data → colección `admins` → crear/borrar un documento con el correo como
// ID. No hace falta tocar código ni hacer deploy.
export async function checkIsAdmin(email: string | null | undefined): Promise<boolean> {
  if (!email) return false
  const snap = await getDoc(doc(db, "admins", email))
  return snap.exists()
}
