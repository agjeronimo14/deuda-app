import { json, error } from '../_util/response.js'
import { hashPassword } from '../_util/crypto.js'
import { getUserByUsername } from '../_util/db.js'

export async function onRequestPost(context) {
  const { DB } = context.env
  if (!DB) return error(500, 'DB binding missing. Variable name debe ser DB.')

  const countRow = await DB.prepare('SELECT COUNT(*) AS c FROM users').first()
  const total = Number(countRow?.c || 0)
  if (total > 0) {
    return error(403, 'Registro deshabilitado. Pide acceso al ADMIN.')
  }

  let body
  try { body = await context.request.json() } catch { return error(400, 'JSON inválido') }

  const username = String(body.username || '').trim().toLowerCase()
  const password = String(body.password || '')

  if (!username || username.length < 3) return error(400, 'Usuario muy corto (mínimo 3)')
  if (password.length < 6) return error(400, 'Contraseña muy corta (mínimo 6)')

  const exists = await getUserByUsername(DB, username)
  if (exists) return error(409, 'Ese usuario ya existe')

  const email = `${username}@local`
  const password_hash = await hashPassword(password)

  const res = await DB.prepare(
    'INSERT INTO users (email, username, password_hash, role, is_active) VALUES (?, ?, ?, ?, 1)'
  ).bind(email, username, password_hash, 'admin').run()

  return json({ ok: true, user_id: res.meta.last_row_id })
}
