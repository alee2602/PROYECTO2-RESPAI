import { test } from "node:test"
import assert from "node:assert/strict"
import { knownOutlet, newsSearchUrl, outletsFor } from "./outlets.ts"

test("los medios de un país incluyen los del país y las agencias internacionales", () => {
  const names = outletsFor("Guatemala").map((o) => o.name)
  assert.ok(names.includes("Prensa Libre"))
  assert.ok(names.includes("Reuters"))
  assert.ok(outletsFor("Francia").length > 0) // país sin lista propia: solo internacionales
})

test("reconoce el medio por dominio y subdominio, no por parecido", () => {
  assert.equal(knownOutlet("https://www.prensalibre.com/guatemala/x")?.name, "Prensa Libre")
  assert.equal(knownOutlet("https://mundo.bbc.com/noticia")?.name, "BBC Mundo")
  assert.equal(knownOutlet("https://prensalibre.com.fake.net/x"), null)
  assert.equal(knownOutlet("https://noprensalibre.com/x"), null)
  assert.equal(knownOutlet("no es url"), null)
})

test("el enlace de búsqueda lleva el título y, si se pide, solo esos medios", () => {
  const url = new URL(newsSearchUrl("Corte de agua", [{ name: "AGN", domain: "agn.gt" }]))
  assert.equal(url.hostname, "news.google.com")
  assert.equal(url.searchParams.get("q"), "Corte de agua (site:agn.gt)")
  assert.equal(new URL(newsSearchUrl("Corte de agua")).searchParams.get("q"), "Corte de agua")
})
