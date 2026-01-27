import { json, error } from '../_util/response.js'
import { hashPassword } from '../_util/crypto.js'
import { getUserByUsername } from '../_util/db.js'

export async function onRequestPost(context) {
  const { DB } = context.env
  if (!DB) return error(500, 'DB binding missing. En Cloudflare Pages → Settings → Bindings crea una D1 con Variable name = DB.')

  let body
  try { body = await context.request.json() } catch { return error(400, 'JSON inválido') }

  const username = String(body.username || '').trim().toLowerCase()
  const password = String(body.password || '')

  if (!username || username.length < 3) return error(400, 'Usuario muy corto (mínimo 3)')
  if (password.length < 6) return error(400, 'Contraseña muy corta (mínimo 6)')

  try {
    const exists = await getUserByUsername(DB, username)
    if (exists) return error(409, 'Ese usuario ya existe')

    // El esquema actual requiere email NOT NULL. Guardamos un email "interno" para cumplir.
    const email = `${username}@local`
    const password_hash = await hashPassword(password)

    const res = await DB.prepare(
      'INSERT INTO users (email, username, password_hash) VALUES (?, ?, ?)'
    ).bind(email, username, password_hash).run()

    return json({ ok: true, user_id: res.meta.last_row_id })
  } catch (e) {
    // DEV: devolvemos el motivo real para diagnosticar (puedes quitarlo después)
    const msg = (e && e.message) ? e.message : String(e)
    return error(500, `DB error: ${msg}`)
  }
}
