import { test } from "node:test"
import assert from "node:assert/strict"
import type { News } from "@respai/shared"
import type { Generate } from "./chatPipeline.ts"
import { meteredAnswer, type MeteredDeps } from "./meteredChat.ts"
import { WORST_CASE_COST_USD, costUsd } from "./pricing.ts"
import { PaidModelError, emptyCounters, hourKey } from "./usage.ts"
import { MemoryUsageStore } from "./usageStore.ts"

// Pruebas del chat CON medidor (Rol 5), sin red y sin gastar: el modelo es
// falso y el almacenamiento está en memoria. Ver docs/medidor-gasto.md.

function makeNews(n: Partial<News> & Pick<News, "id" | "title">): News {
  return {
    summary: "",
    body: "",
    sources: [{ name: "Fuente", type: "original" }],
    authorId: "test",
    validationStatus: "confirmed",
    scope: "national",
    topics: [],
    createdAt: "2026-10-01T00:00:00.000Z",
    ...n,
  }
}

const NEWS: News[] = [
  makeNews({
    id: "espana", title: "Pedro Sánchez adelanta elecciones en España", country: "España", topics: ["política"],
    summary: "Las elecciones generales serán el 29 de noviembre.",
  }),
]
const LOCATION = { country: "Guatemala", region: "Quetzaltenango" }
const NOW = new Date("2026-10-13T15:04:05Z")
const USAGE = { inputTokens: 900, outputTokens: 80 }
const NEEDS_MODEL = "Explícame las elecciones en España"
const NO_NEWS = "¿Qué pasó con el terremoto en Japón?"

function setup(overrides: Partial<Omit<MeteredDeps, "store">> = {}) {
  const store = new MemoryUsageStore()
  const calls: string[] = []
  const generate: Generate = async (prompt) => {
    calls.push(prompt.user)
    return { text: "Se adelantan las elecciones [1].", usage: USAGE }
  }
  let loads = 0
  const deps: MeteredDeps = { store, generate, now: NOW, today: "2026-10-13", ...overrides }
  const ask = (question: string, uid = "u1") =>
    meteredAnswer(uid, { question, location: LOCATION }, async () => { loads++; return NEWS }, deps)
  return { store, calls, ask, loads: () => loads }
}

const reason = (r: { kind: string; reason?: string }) => (r.kind === "no_answer" ? r.reason : null)

test("necesita modelo: lo llama una vez y registra tokens y costo reales", async () => {
  const { store, calls, ask } = setup()
  const { response, trace } = await ask(NEEDS_MODEL)
  assert.equal(response.kind, "answer")
  assert.equal(calls.length, 1)
  assert.equal(trace.path, "model")
  assert.equal(trace.costUsd, costUsd(USAGE))
  assert.equal(store.totals.questions.model, 1)
  assert.equal(store.totals.inputTokens, 900)
  assert.equal(store.totals.outputTokens, 80)
  assert.equal(store.totals.spentUsd, costUsd(USAGE))
  assert.equal(store.hours.get(hourKey(NOW))?.spentUsd, costUsd(USAGE))
})

test("sin noticias: no llama al modelo y cuenta como no_model (USD 0)", async () => {
  const { store, calls, ask } = setup()
  const { response, trace } = await ask(NO_NEWS)
  assert.equal(response.kind, "no_answer")
  assert.equal(trace.path, "no_model")
  assert.equal(calls.length, 0)
  assert.equal(store.totals.questions.no_model, 1)
  assert.equal(store.totals.spentUsd, 0)
})

test("apagado por un admin: chat_disabled, no lee noticias ni llama al modelo", async () => {
  const { store, calls, ask, loads } = setup()
  store.config = { ...store.config, enabled: false, disabledBy: "admin" }
  const { response, trace } = await ask(NEEDS_MODEL)
  assert.equal(reason(response), "chat_disabled")
  assert.equal(trace.path, "disabled")
  assert.equal(trace.reason, "admin")
  assert.equal(loads(), 0)
  assert.equal(calls.length, 0)
  assert.equal(store.totals.questions.disabled, 1)
})

test("cruzar la reserva: budget_exhausted, apaga el chat, no lee noticias ni llama al modelo", async () => {
  const { store, calls, ask, loads } = setup()
  store.totals = { ...emptyCounters(), spentUsd: 10 - WORST_CASE_COST_USD / 2 }
  const { response, trace } = await ask(NEEDS_MODEL)
  assert.equal(reason(response), "budget_exhausted")
  assert.equal(trace.path, "disabled")
  assert.equal(trace.reason, "reserve")
  assert.equal(store.config.enabled, false)
  assert.equal(store.config.disabledBy, "reserve")
  assert.equal(loads(), 0)
  assert.equal(calls.length, 0)
})

test("después de apagarse por reserva: la siguiente pregunta no vuelve a leer el gasto", async () => {
  const { store, ask } = setup()
  store.totals = { ...emptyCounters(), spentUsd: 10 }
  await ask(NEEDS_MODEL)
  let spendReads = 0
  const original = store.getTotalSpend.bind(store)
  store.getTotalSpend = async () => {
    spendReads++
    return original()
  }
  const { response } = await ask(NEEDS_MODEL)
  assert.equal(reason(response), "budget_exhausted")
  assert.equal(spendReads, 0)
})

test("un admin enciende con el saldo bajo la reserva: la siguiente pregunta lo vuelve a apagar", async () => {
  const { store, calls, ask } = setup()
  store.totals = { ...emptyCounters(), spentUsd: 10 }
  await ask(NEEDS_MODEL)
  store.config = { ...store.config, enabled: true, disabledBy: null } // encendido manual
  const { response } = await ask(NEEDS_MODEL)
  assert.equal(reason(response), "budget_exhausted")
  assert.equal(store.config.enabled, false)
  assert.equal(calls.length, 0)
})

test("con margen para una llamada más: sí llama al modelo", async () => {
  const { store, calls, ask } = setup()
  store.totals = { ...emptyCounters(), spentUsd: 10 - 2 * WORST_CASE_COST_USD }
  await ask(NEEDS_MODEL)
  assert.equal(calls.length, 1)
})

test("reserva levantada a 0 en la demo: se usa el crédito reservado", async () => {
  const { store, calls, ask } = setup()
  store.totals = { ...emptyCounters(), spentUsd: 15 }
  store.config = { ...store.config, reserveUsd: 0 }
  await ask(NEEDS_MODEL)
  assert.equal(calls.length, 1)
})

test("límite por usuario (5 por minuto): la sexta no lee noticias ni llama al modelo", async () => {
  const { store, calls, ask, loads } = setup()
  for (let i = 0; i < 5; i++) await ask(NEEDS_MODEL)
  const { response, trace } = await ask(NEEDS_MODEL)
  assert.equal(reason(response), "rate_limited")
  assert.equal(trace.path, "rate_limited")
  assert.equal(calls.length, 5)
  assert.equal(loads(), 5)
  assert.equal(store.totals.questions.rate_limited, 1)
})

test("sin API key: modo de prueba", async () => {
  const { store, ask } = setup({ generate: null })
  const { response, trace } = await ask(NEEDS_MODEL)
  assert.equal(response.kind === "answer" && response.generatedBy, "rules")
  assert.equal(trace.path, "simulated")
  assert.equal(store.totals.questions.simulated, 1)
})

test("el modelo cobró pero no sirvió: mensaje claro y el costo igual se registra", async () => {
  const failing: Generate = async () => {
    throw new PaidModelError("refusal", USAGE)
  }
  const { store, ask } = setup({ generate: failing })
  const { response, trace } = await ask(NEEDS_MODEL)
  assert.equal(reason(response), "error")
  assert.equal(trace.path, "error")
  assert.equal(store.totals.spentUsd, costUsd(USAGE))
  assert.equal(store.totals.questions.error, 1)
})

test("Firestore caído al leer la config: error, no lee noticias ni llama al modelo", async () => {
  const { store, calls, ask, loads } = setup()
  store.getConfig = async () => {
    throw new Error("Firestore caído")
  }
  const { response, trace } = await ask(NEEDS_MODEL)
  assert.equal(reason(response), "error")
  assert.equal(trace.path, "error")
  assert.equal(trace.reason, "store")
  assert.equal(loads(), 0)
  assert.equal(calls.length, 0)
})

test("Firestore caído al leer el gasto: no llama al modelo", async () => {
  const { store, calls, ask } = setup()
  store.getTotalSpend = async () => {
    throw new Error("Firestore caído")
  }
  const { response } = await ask(NEEDS_MODEL)
  assert.equal(reason(response), "error")
  assert.equal(calls.length, 0)
})

test("Firestore caído en el límite por usuario: no llama al modelo", async () => {
  const { store, calls, ask, loads } = setup()
  store.consumeRateLimit = async () => {
    throw new Error("Firestore caído")
  }
  const { response, trace } = await ask(NEEDS_MODEL)
  assert.equal(reason(response), "error")
  assert.equal(trace.reason, "store")
  assert.equal(loads(), 0)
  assert.equal(calls.length, 0)
})

test("falla al registrar después de pagar: la respuesta sale igual", async () => {
  const { store, ask } = setup()
  store.record = async () => {
    throw new Error("Firestore caído")
  }
  const { response, trace } = await ask(NEEDS_MODEL)
  assert.equal(response.kind, "answer")
  assert.equal(trace.recordFailed, true)
  assert.equal(trace.costUsd, costUsd(USAGE))
})

// --- Privacidad de los logs (docs/medidor-gasto.md) ---------------------------

async function captureErrors(fn: () => Promise<unknown>): Promise<string> {
  const original = console.error
  const lines: string[] = []
  console.error = (...args: unknown[]) => {
    lines.push(args.map((a) => (typeof a === "string" ? a : JSON.stringify(a) ?? String(a))).join(" "))
    lines.push(args.map((a) => String((a as { message?: unknown })?.message ?? "")).join(" "))
  }
  try {
    await fn()
  } finally {
    console.error = original
  }
  return lines.join("\n")
}

test("logs: un error del modelo con el texto de la pregunta no lo filtra al log", async () => {
  const leaky: Generate = async (prompt) => {
    throw new Error(`fallo procesando: ${prompt.user}`)
  }
  const { ask } = setup({ generate: leaky })
  const logged = await captureErrors(() => ask(NEEDS_MODEL))
  assert.ok(logged.length > 0, "debería registrar algo")
  assert.ok(!logged.includes("España"), logged)
})

test("logs: Firestore caído con un mensaje raro no lo filtra al log", async () => {
  const { store, ask } = setup()
  store.getConfig = async () => {
    throw new Error(`no se pudo: ${NEEDS_MODEL}`)
  }
  store.record = async () => {
    throw new Error(`tampoco: ${NEEDS_MODEL}`)
  }
  const logged = await captureErrors(() => ask(NEEDS_MODEL))
  assert.ok(logged.length > 0)
  assert.ok(!logged.includes("España"), logged)
})
