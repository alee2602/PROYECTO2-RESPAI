import { test } from "node:test"
import assert from "node:assert/strict"
import { draftFromDoc, emptyDraft, parseTopics, toNewsDoc, toNewsUpdate, validateDraft, type NewsDraft } from "./newsDraft.ts"

// Noticia local completa y publicable, como punto de partida de cada caso.
function complete(patch: Partial<NewsDraft> = {}): NewsDraft {
  return {
    ...emptyDraft(),
    title: "Corte de agua en zona 1",
    summary: "Habrá corte de agua el sábado.",
    body: "La municipalidad anunció un corte de agua...",
    scope: "local",
    country: "Guatemala",
    region: "Ciudad de Guatemala",
    topics: "Servicios públicos, agua",
    sources: [{ name: "Municipalidad de Guatemala", url: "https://muniguate.com", type: "original" }],
    validationStatus: "unverified",
    validationNote: "Solo hay un comunicado; falta una segunda fuente.",
    ...patch,
  }
}

test("una noticia completa se puede publicar", () => {
  assert.deepEqual(validateDraft(complete(), "publish"), [])
})

test("confirmada exige 2 fuentes que no sean IA, también en borrador", () => {
  const one = complete({ validationStatus: "confirmed" })
  assert.equal(validateDraft(one, "publish").length, 1)
  assert.equal(validateDraft(one, "draft").length, 1)

  const two = complete({
    validationStatus: "confirmed",
    sources: [
      { name: "Municipalidad", url: "", type: "original" },
      { name: "Prensa Libre", url: "", type: "summary" },
    ],
  })
  assert.deepEqual(validateDraft(two, "publish"), [])
})

test("una fuente de IA nunca cuenta como prueba para confirmar", () => {
  const withAi = complete({
    validationStatus: "confirmed",
    sources: [
      { name: "Municipalidad", url: "", type: "original" },
      { name: "Resumen automático", url: "", type: "ai" },
    ],
  })
  assert.match(validateDraft(withAi, "publish")[0]!, /hay 1/)
})

test("en desarrollo o no verificada exigen nota de validación", () => {
  for (const validationStatus of ["in_progress", "unverified"] as const) {
    const errors = validateDraft(complete({ validationStatus, validationNote: "  " }), "publish")
    assert.equal(errors.length, 1)
    assert.match(errors[0]!, /nota de validación/)
  }
})

test("no se publica sin fuentes", () => {
  const errors = validateDraft(complete({ sources: [{ name: "", url: "", type: "original" }] }), "publish")
  assert.ok(errors.some((e) => e.includes("procedencia")))
})

test("local necesita región; nacional no; internacional ni siquiera país", () => {
  assert.equal(validateDraft(complete({ region: "" }), "publish").length, 1)
  assert.deepEqual(validateDraft(complete({ scope: "national", region: "" }), "publish"), [])
  assert.deepEqual(validateDraft(complete({ scope: "international", country: "", region: "" }), "publish"), [])
})

test("un borrador solo necesita título", () => {
  assert.deepEqual(validateDraft({ ...emptyDraft(), title: "Idea" }, "draft"), [])
  assert.equal(validateDraft(emptyDraft(), "draft").length, 1)
})

test("URL de fuente inválida se rechaza", () => {
  const errors = validateDraft(complete({ sources: [{ name: "X", url: "muniguate.com", type: "original" }] }), "draft")
  assert.equal(errors.length, 1)
})

test("temas: minúsculas, sin espacios ni repetidos", () => {
  assert.deepEqual(parseTopics(" Salud, salud ,  Economía,,"), ["salud", "economía"])
})

test("el documento no lleva campos vacíos y solo publicar pone publishedAt", () => {
  const draft = complete({
    scope: "international",
    country: "",
    region: "Ciudad de Guatemala", // quedó de antes: internacional no guarda región
    sources: [
      { name: "Fuente A", url: "", type: "original" },
      { name: "", url: "", type: "summary" },
    ],
  })
  const doc = toNewsDoc(draft, "uid-1", false)
  assert.equal("country" in doc, false)
  assert.equal("region" in doc, false)
  assert.equal("publishedAt" in doc, false)
  assert.deepEqual(doc.sources, [{ name: "Fuente A", type: "original" }])
  assert.equal(doc.authorId, "uid-1")
  assert.equal("publishedAt" in toNewsDoc(draft, "uid-1", true), true)
})

test("editar: un opcional que se vació se borra del documento, y no toca autor ni fechas de creación", () => {
  const update = toNewsUpdate(complete({ validationStatus: "unverified", validationNote: "", region: "" }))
  for (const key of ["validationNote", "region"]) {
    assert.equal(typeof update[key], "object", `${key} debería ser deleteField()`)
  }
  assert.equal(update.title, "Corte de agua en zona 1")
  assert.ok("updatedAt" in update)
  for (const key of ["authorId", "createdAt", "publishedAt", "image"]) assert.equal(key in update, false)
})

test("editar: cargar un documento y volverlo a guardar no cambia el contenido", () => {
  const original = complete()
  const doc = toNewsDoc(original, "uid-1", true) as unknown as Record<string, unknown>
  const roundTrip = draftFromDoc(doc)
  assert.deepEqual(validateDraft(roundTrip, "publish"), [])
  assert.equal(roundTrip.topics, "servicios públicos, agua")
  assert.equal(roundTrip.sources[0]!.url, "https://muniguate.com")
})

test("editar: un documento incompleto o con valores raros se carga con valores seguros", () => {
  const d = draftFromDoc({ title: "Vieja", validationStatus: "verdadera", sources: [{ name: "X", type: "otro" }, null] })
  assert.equal(d.validationStatus, "unverified") // nunca se asume "confirmed"
  assert.deepEqual(d.sources, [{ name: "X", url: "", type: "original" }])
  assert.equal(d.scope, "local")
})
