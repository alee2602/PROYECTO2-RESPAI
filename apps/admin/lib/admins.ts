// Correos con acceso al portal. ESPEJO de isAdmin() en /firestore.rules:
// si se agrega o quita un correo allá, hay que cambiarlo aquí en el mismo PR.
//
// Esta lista solo decide qué pantalla ve la persona (UX). La seguridad real
// la ponen las reglas de Firestore: aunque alguien se saltara esta pantalla,
// el servidor rechaza cualquier escritura en `news` de un correo no admin.
export const ADMIN_EMAILS = ["malejandras2004@gmail.com", "biancalderon01.15@gmail.com"]

export function isAdminEmail(email: string | null | undefined): boolean {
  return !!email && ADMIN_EMAILS.includes(email.toLowerCase())
}
