import { json } from '../_util/response.js'
import { clearSession } from '../_util/auth.js'

export async function onRequestPost(context) {
  const cookie = await clearSession(context)
  return json({ ok: true }, { headers: { 'Set-Cookie': cookie } })
}
