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
  const deps: MeteredDeps = {
    store, generate, budget: { budgetUsd: 20, reserveUsd: 10 }, now: NOW, today: "2026-10-13", ...overrides,
  }
  const ask = (question: string, uid = "u1") =>
    meteredAnswer(uid, { question, location: LOCATION }, async () => { loads++; return NEWS }, deps)
  return { store, calls, ask, loads: () => loads }
}

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

test("chat apagado: no lee noticias ni llama al modelo", async () => {
  const { store, calls, ask, loads } = setup()
  store.config = { ...store.config, enabled: false }
  const { response, trace } = await ask(NEEDS_MODEL)
  assert.equal(response.kind === "no_answer" && response.reason, "chat_disabled")
  assert.equal(trace.path, "disabled")
  assert.equal(loads(), 0)
  assert.equal(calls.length, 0)
  assert.equal(store.totals.questions.disabled, 1)
})

test("límite por minuto: la pregunta extra no lee noticias ni llama al modelo", async () => {
  const { store, calls, ask, loads } = setup()
  store.config = { enabled: true, limits: { perMinute: 2, perDay: 40, hourlyUsd: 1 } }
  await ask(NEEDS_MODEL)
  await ask(NEEDS_MODEL)
  const { response, trace } = await ask(NEEDS_MODEL)
  assert.equal(response.kind === "no_answer" && response.reason, "rate_limited")
  assert.equal(trace.path, "rate_limited")
  assert.equal(calls.length, 2)
  assert.equal(loads(), 2)
  assert.equal(store.totals.questions.rate_limited, 1)
})

test("tope total: gasto + peor caso > USD 10 → budget_exhausted sin llamar al modelo", async () => {
  const { store, calls, ask } = setup()
  store.totals = { ...emptyCounters(), spentUsd: 10 - WORST_CASE_COST_USD / 2 }
  const { response, trace } = await ask(NEEDS_MODEL)
  assert.equal(response.kind === "no_answer" && response.reason, "budget_exhausted")
  assert.equal(trace.path, "budget_blocked")
  assert.equal(trace.reason, "total")
  assert.equal(calls.length, 0)
})

test("tope total: con margen para una llamada más, sí llama al modelo", async () => {
  const { store, calls, ask } = setup()
  store.totals = { ...emptyCounters(), spentUsd: 10 - 2 * WORST_CASE_COST_USD }
  await ask(NEEDS_MODEL)
  assert.equal(calls.length, 1)
})

test("freno por hora: el gasto de la hora llegó al límite → budget_exhausted", async () => {
  const { store, calls, ask } = setup()
  store.hours.set(hourKey(NOW), { ...emptyCounters(), spentUsd: 1 })
  const { trace } = await ask(NEEDS_MODEL)
  assert.equal(trace.path, "budget_blocked")
  assert.equal(trace.reason, "hourly")
  assert.equal(calls.length, 0)
})

test("presupuesto mal configurado: modo de prueba, nunca llama al modelo", async () => {
  const { calls, ask } = setup({ budget: null })
  const { response, trace } = await ask(NEEDS_MODEL)
  assert.equal(response.kind === "answer" && response.generatedBy, "rules")
  assert.equal(trace.path, "simulated")
  assert.equal(calls.length, 0)
})

test("sin API key: modo de prueba", async () => {
  const { store, ask } = setup({ generate: null })
  const { trace } = await ask(NEEDS_MODEL)
  assert.equal(trace.path, "simulated")
  assert.equal(store.totals.questions.simulated, 1)
})

test("el modelo cobró pero no sirvió: mensaje claro y el costo igual se registra", async () => {
  const failing: Generate = async () => {
    throw new PaidModelError("refusal", USAGE)
  }
  const { store, ask } = setup({ generate: failing })
  const { response, trace } = await ask(NEEDS_MODEL)
  assert.equal(response.kind === "no_answer" && response.reason, "error")
  assert.equal(trace.path, "error")
  assert.equal(store.totals.spentUsd, costUsd(USAGE))
  assert.equal(store.totals.questions.error, 1)
})

test("Firestore caído al leer la config: no lee noticias ni llama al modelo", async () => {
  const { store, calls, ask, loads } = setup()
  store.getConfig = async () => {
    throw new Error("Firestore caído")
  }
  const { response } = await ask(NEEDS_MODEL)
  assert.equal(response.kind === "no_answer" && response.reason, "error")
  assert.equal(loads(), 0)
  assert.equal(calls.length, 0)
})

test("Firestore caído al revisar el gasto: no llama al modelo", async () => {
  const { store, calls, ask } = setup()
  store.getSpend = async () => {
    throw new Error("Firestore caído")
  }
  const { response, trace } = await ask(NEEDS_MODEL)
  assert.equal(response.kind === "no_answer" && response.reason, "error")
  assert.equal(trace.path, "error")
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
