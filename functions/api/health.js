import { json } from './_util/response.js'

export async function onRequestGet() {
  return json({ ok: true, ts: new Date().toISOString() })
}
