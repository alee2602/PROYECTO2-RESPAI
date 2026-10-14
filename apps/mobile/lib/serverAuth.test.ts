import { test } from "node:test"
import assert from "node:assert/strict"
import { parseServiceAccount } from "./serverAuth.ts"

const VALID = JSON.stringify({
  project_id: "respai-news-app",
  client_email: "medidor@respai-news-app.iam.gserviceaccount.com",
  private_key: "-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----\n",
})

test("cuenta de servicio válida", () => {
  assert.deepEqual(parseServiceAccount(VALID), {
    projectId: "respai-news-app",
    clientEmail: "medidor@respai-news-app.iam.gserviceaccount.com",
    privateKey: "-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----\n",
  })
})

test("sin variable, JSON roto o campos faltantes → null (medidor apagado, sin modelo)", () => {
  assert.equal(parseServiceAccount(undefined), null)
  assert.equal(parseServiceAccount(""), null)
  assert.equal(parseServiceAccount("{no es json"), null)
  assert.equal(parseServiceAccount(JSON.stringify({ project_id: "x" })), null)
})
