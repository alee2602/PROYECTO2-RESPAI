import { test } from "node:test"
import assert from "node:assert/strict"
import { checkGlobalLimit } from "./globalLimit.ts"
import { WORST_CASE_COST_USD } from "./pricing.ts"
import { emptyCounters } from "./usage.ts"
import { MemoryUsageStore } from "./usageStore.ts"

// El límite global (Rol 5): interruptor + reserva. Única pieza que conoce el
// saldo. Ver docs/superpowers/specs/2026-10-13-tablero-costos-design.md §5.4.

function storeWithSpend(spentUsd: number) {
  const s = new MemoryUsageStore()
  s.totals = { ...emptyCounters(), spentUsd }
  return s
}

test("encendido y con saldo: se permite", async () => {
  assert.deepEqual(await checkGlobalLimit(new MemoryUsageStore()), { allowed: true })
})

test("apagado por un admin: 'admin', sin leer el gasto", async () => {
  const s = new MemoryUsageStore()
  s.config = { ...s.config, enabled: false, disabledBy: "admin" }
  let reads = 0
  s.getTotalSpend = async () => {
    reads++
    return 0
  }
  assert.deepEqual(await checkGlobalLimit(s), { allowed: false, why: "admin" })
  assert.equal(reads, 0)
})

test("apagado sin quién (p. ej. a mano en la consola): cuenta como 'admin'", async () => {
  const s = new MemoryUsageStore()
  s.config = { ...s.config, enabled: false, disabledBy: null }
  assert.deepEqual(await checkGlobalLimit(s), { allowed: false, why: "admin" })
})

test("apagado por la reserva: 'reserve'", async () => {
  const s = new MemoryUsageStore()
  s.config = { ...s.config, enabled: false, disabledBy: "reserve" }
  assert.deepEqual(await checkGlobalLimit(s), { allowed: false, why: "reserve" })
})

test("cruzar la reserva: apaga el interruptor y responde 'reserve'", async () => {
  const s = storeWithSpend(10 - WORST_CASE_COST_USD / 2)
  assert.deepEqual(await checkGlobalLimit(s), { allowed: false, why: "reserve" })
  assert.equal(s.config.enabled, false)
  assert.equal(s.config.disabledBy, "reserve")
  assert.equal(s.disableWrites, 1)
})

test("con margen para una llamada más: se permite y no apaga", async () => {
  const s = storeWithSpend(10 - 2 * WORST_CASE_COST_USD)
  assert.deepEqual(await checkGlobalLimit(s), { allowed: true })
  assert.equal(s.disableWrites, 0)
})

test("reserva levantada a 0: se permite aunque se haya gastado más de 10", async () => {
  const s = storeWithSpend(15)
  s.config = { ...s.config, reserveUsd: 0 }
  assert.deepEqual(await checkGlobalLimit(s), { allowed: true })
})

test("dos preguntas cruzan la reserva a la vez: una sola escritura de apagado", async () => {
  const s = storeWithSpend(10)
  const r = await Promise.all([checkGlobalLimit(s), checkGlobalLimit(s)])
  assert.deepEqual(r, [
    { allowed: false, why: "reserve" },
    { allowed: false, why: "reserve" },
  ])
  assert.equal(s.disableWrites, 1)
})

test("Firestore caído al leer la config: 'store'", async () => {
  const s = new MemoryUsageStore()
  s.getConfig = async () => {
    throw new Error("caído")
  }
  assert.deepEqual(await checkGlobalLimit(s), { allowed: false, why: "store" })
})

test("Firestore caído al leer el gasto: 'store'", async () => {
  const s = new MemoryUsageStore()
  s.getTotalSpend = async () => {
    throw new Error("caído")
  }
  assert.deepEqual(await checkGlobalLimit(s), { allowed: false, why: "store" })
})

test("falla al apagar después de cruzar: igual 'reserve' (no se llama al modelo)", async () => {
  const s = storeWithSpend(10)
  s.disableChat = async () => {
    throw new Error("caído")
  }
  assert.deepEqual(await checkGlobalLimit(s), { allowed: false, why: "reserve" })
})
