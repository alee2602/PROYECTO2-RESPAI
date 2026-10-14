// ---------------------------------------------------------------------------
// Logs del servidor sin contenido (Rol 5). De un error solo se registran
// datos fijos: su tipo, el status HTTP y el código técnico. NUNCA el mensaje
// ni el objeto entero: son texto libre y podrían traer la pregunta, la
// respuesta o el prompt. Regla en docs/medidor-gasto.md ("Qué se guarda y qué no").
// ---------------------------------------------------------------------------

export type SafeError = { name: string; status?: number; code?: string | number }

// Identificador técnico corto (TypeError, resource-exhausted, ECONNRESET…), sin espacios.
const FIXED = /^[A-Za-z][A-Za-z0-9_./-]{0,39}$/

export function safeError(e: unknown): SafeError {
  if (e === null) return { name: "null" }
  if (!(e instanceof Error)) return { name: typeof e }
  const out: SafeError = { name: FIXED.test(e.name) ? e.name : "Error" }
  const { status, code } = e as { status?: unknown; code?: unknown }
  if (typeof status === "number" && Number.isInteger(status)) out.status = status
  if (typeof code === "number" && Number.isInteger(code)) out.code = code
  else if (typeof code === "string" && FIXED.test(code)) out.code = code
  return out
}
