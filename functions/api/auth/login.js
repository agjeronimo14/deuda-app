import { json, error } from '../_util/response.js'
import { getUserByEmail } from '../_util/db.js'
import { verifyPassword } from '../_util/crypto.js'
import { createSession } from '../_util/auth.js'

export async function onRequestPost(context) {
  const { DB } = context.env
  let body
  try { body = await context.request.json() } catch { return error(400, 'JSON inválido') }

  const email = String(body.email || '').trim().toLowerCase()
  const password = String(body.password || '')

  if (!email || !password) return error(400, 'Faltan datos')

  const user = await getUserByEmail(DB, email)
  if (!user) return error(401, 'Credenciales inválidas')

  const ok = await verifyPassword(password, user.password_hash)
  if (!ok) return error(401, 'Credenciales inválidas')

  const { cookie } = await createSession(context, user.id)
  return json({ ok: true, user: { id: user.id, email: user.email, username: user.username } }, { headers: { 'Set-Cookie': cookie } })
}
