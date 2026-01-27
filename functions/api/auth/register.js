import { json, error } from '../_util/response.js'
import { getUserByEmail } from '../_util/db.js'
import { hashPassword } from '../_util/crypto.js'

export async function onRequestPost(context) {
  const { DB } = context.env
  let body
  try { body = await context.request.json() } catch { return error(400, 'JSON inválido') }

  const email = String(body.email || '').trim().toLowerCase()
  const username = body.username ? String(body.username).trim() : null
  const password = String(body.password || '')

  if (!email || !email.includes('@')) return error(400, 'Email inválido')
  if (password.length < 6) return error(400, 'Contraseña muy corta (mínimo 6)')
  if (username && username.length < 3) return error(400, 'Usuario muy corto (mínimo 3)')

  const exists = await getUserByEmail(DB, email)
  if (exists) return error(409, 'Ese email ya existe')

  const password_hash = await hashPassword(password)
  try {
    const res = await DB.prepare('INSERT INTO users (email, username, password_hash) VALUES (?, ?, ?)').bind(email, username, password_hash).run()
    return json({ ok: true, user_id: res.meta.last_row_id })
  } catch {
    return error(400, 'No se pudo crear (revisa usuario/email)')
  }
}
