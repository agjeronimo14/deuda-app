import { json, error } from '../_util/response.js'
import { verifyPassword } from '../_util/crypto.js'
import { createSession } from '../_util/auth.js'
import { getUserByUsername } from '../_util/db.js'

export async function onRequestPost(context) {
  const { DB } = context.env
  if (!DB) return error(500, 'DB binding missing. Variable name debe ser DB.')

  let body
  try { body = await context.request.json() } catch { return error(400, 'JSON inválido') }

  const username = String(body.username || '').trim().toLowerCase()
  const password = String(body.password || '')

  if (!username || !password) return error(400, 'Faltan datos')

  try {
    const user = await getUserByUsername(DB, username)
    if (!user) return error(401, 'Credenciales inválidas')
    if (Number(user.is_active ?? 1) !== 1) return error(403, 'Usuario desactivado')

    const ok = await verifyPassword(password, user.password_hash)
    if (!ok) return error(401, 'Credenciales inválidas')

    const { cookie } = await createSession(context, user.id)
    return json({ ok: true, user: { id: user.id, username: user.username, role: user.role || 'user' } }, { headers: { 'Set-Cookie': cookie } })
  } catch (e) {
    return error(500, 'Error en login')
  }
}
