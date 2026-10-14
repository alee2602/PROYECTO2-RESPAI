import { cert, getApps, initializeApp, type App } from "firebase-admin/app"
import { getAuth } from "firebase-admin/auth"

// ---------------------------------------------------------------------------
// Firebase Admin SDK (Rol 5). SOLO SERVIDOR. Le da al endpoint del chat una
// identidad propia para escribir el medidor de gasto, que el usuario no puede
// tocar con su token. Clave: FIREBASE_SERVICE_ACCOUNT (JSON) en Vercel.
// Por qué hace falta: docs/medidor-gasto.md.
// ---------------------------------------------------------------------------

export type ServiceAccount = { projectId: string; clientEmail: string; privateKey: string }

export function parseServiceAccount(raw: string | undefined): ServiceAccount | null {
  if (!raw) return null
  try {
    const j = JSON.parse(raw) as Record<string, unknown>
    if (typeof j.project_id !== "string" || typeof j.client_email !== "string" || typeof j.private_key !== "string") {
      return null
    }
    return { projectId: j.project_id, clientEmail: j.client_email, privateKey: j.private_key }
  } catch {
    return null
  }
}

// null si falta la cuenta de servicio: el endpoint sigue en modo de prueba.
export function getAdminApp(): App | null {
  const sa = parseServiceAccount(process.env.FIREBASE_SERVICE_ACCOUNT)
  if (!sa) return null
  return getApps()[0] ?? initializeApp({ credential: cert(sa) })
}

// Verifica el ID token del usuario (firma, vencimiento, proyecto). null si no vale.
export async function verifyUid(app: App, idToken: string): Promise<string | null> {
  try {
    return (await getAuth(app).verifyIdToken(idToken)).uid
  } catch {
    return null
  }
}
