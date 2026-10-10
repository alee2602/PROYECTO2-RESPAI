import { test } from "node:test"
import assert from "node:assert/strict"
import { attributionFor, ILLUSTRATIVE_PREFIX, licenseLabel, openverseSearchUrl, parseOpenverse } from "./images.ts"

// Forma real de un resultado de Openverse (búsqueda "volcan de fuego", 2026-10-10).
const SAMPLE = {
  result_count: 240,
  results: [
    {
      id: "d3ff6679-22a1-4a1a-a3d7-6218424946fa",
      title: "Volcan de Fuego y Acatenango",
      url: "https://upload.wikimedia.org/wikipedia/commons/2/20/Volcan_de_Fuego_y_Acatenango.jpg",
      thumbnail: "https://api.openverse.org/v1/images/d3ff6679-22a1-4a1a-a3d7-6218424946fa/thumb/",
      creator: "Javier Ruata",
      license: "by",
      license_version: "2.0",
      foreign_landing_url: "https://commons.wikimedia.org/w/index.php?curid=11143634",
      source: "wikimedia",
    },
    { id: "sin-licencia", url: "https://example.com/a.jpg", license: "" },
    { id: "http", url: "http://example.com/a.jpg", license: "by" },
  ],
}

test("lee los resultados de Openverse y descarta los que no se pueden atribuir", () => {
  const results = parseOpenverse(SAMPLE)
  assert.equal(results.length, 1)
  assert.equal(results[0]!.license, "CC BY 2.0")
  assert.equal(results[0]!.source, "Wikimedia Commons")
  assert.deepEqual(parseOpenverse({}), [])
  assert.deepEqual(parseOpenverse(null), [])
})

test("la atribución dice primero que es ilustrativa, y lleva autor, licencia y origen", () => {
  const text = attributionFor(parseOpenverse(SAMPLE)[0]!)
  assert.ok(text.startsWith(ILLUSTRATIVE_PREFIX))
  for (const part of ["Javier Ruata", "CC BY 2.0", "Wikimedia Commons", "curid=11143634"]) assert.ok(text.includes(part))
})

test("nombres de licencia legibles", () => {
  assert.equal(licenseLabel("cc0"), "CC0")
  assert.equal(licenseLabel("pdm"), "Dominio público")
  assert.equal(licenseLabel("by-sa", "4.0"), "CC BY-SA 4.0")
})

test("la búsqueda pide pocas imágenes y sin contenido para adultos", () => {
  const url = new URL(openverseSearchUrl("  volcán de Fuego "))
  assert.equal(url.searchParams.get("q"), "volcán de Fuego")
  assert.equal(url.searchParams.get("mature"), "false")
  assert.equal(url.searchParams.get("page_size"), "12")
})
