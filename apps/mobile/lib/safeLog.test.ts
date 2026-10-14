import { test } from "node:test"
import assert from "node:assert/strict"
import { safeError } from "./safeLog.ts"

// Privacidad (docs/medidor-gasto.md, "Qué se guarda y qué no"): de un error
// solo se registran datos fijos, nunca su mensaje (texto libre).

const SECRET = "¿Qué opina mi vecino Juan Pérez sobre las elecciones?"

test("de un Error solo queda el tipo, nunca el mensaje", () => {
  const out = safeError(new TypeError(SECRET))
  assert.deepEqual(out, { name: "TypeError" })
  assert.ok(!JSON.stringify(out).includes("Juan"))
})

test("conserva status HTTP y code técnico si son valores fijos", () => {
  const e = Object.assign(new Error(SECRET), { status: 429, code: "resource-exhausted" })
  assert.deepEqual(safeError(e), { name: "Error", status: 429, code: "resource-exhausted" })
})

test("code numérico (gRPC del Admin SDK) también se conserva", () => {
  assert.deepEqual(safeError(Object.assign(new Error(SECRET), { code: 14 })), { name: "Error", code: 14 })
})

test("un code o name con texto libre se descarta", () => {
  const e = Object.assign(new Error("x"), { code: SECRET })
  e.name = SECRET
  assert.deepEqual(safeError(e), { name: "Error" })
})

test("algo que no es Error (string, objeto, null) → solo su tipo", () => {
  assert.deepEqual(safeError(SECRET), { name: "string" })
  assert.deepEqual(safeError({ question: SECRET }), { name: "object" })
  assert.deepEqual(safeError(null), { name: "null" })
})
