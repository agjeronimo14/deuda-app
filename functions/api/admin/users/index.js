import { json, error } from '../../_util/response.js'
import { requireAdmin } from '../../_util/auth.js'
import { hashPassword } from '../../_util/crypto.js'

function randomPassword(len=10){
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  let out = ''
  for (let i=0;i<len;i++) out += chars[Math.floor(Math.random()*chars.length)]
  return out
}

export async function onRequestGet(context) {
  const { response } = await requireAdmin(context)
  if (response) return response

  const { DB } = context.env
  let res
  try {
    res = await DB.prepare(`
      SELECT id, username, role, is_active, created_at
      FROM users
      ORDER BY id ASC
    `).all()
  } catch {
    res = await DB.prepare(`
      SELECT id, username, created_at
      FROM users
      ORDER BY id ASC
    `).all()
  }

  return json({ users: (res.results || []).map(u => ({
    id: Number(u.id),
    username: u.username,
    role: u.role || 'user',
    is_active: Number(u.is_active ?? 1) === 1,
    created_at: u.created_at,
  })) })
}

export async function onRequestPost(context) {
  const { response } = await requireAdmin(context)
  if (response) return response

  let body
  try { body = await context.request.json() } catch { return error(400, 'JSON inválido') }

  const username = String(body.username || '').trim().toLowerCase()
  const role = body.role === 'admin' ? 'admin' : (body.role === 'counterparty' ? 'counterparty' : 'user')
  let password = String(body.password || '').trim()

  if (!username || username.length < 3) return error(400, 'Usuario muy corto (mínimo 3)')
  if (!password) password = randomPassword(10)
  if (password.length < 6) return error(400, 'Contraseña muy corta (mínimo 6)')

  const { DB } = context.env
  const exists = await DB.prepare('SELECT id FROM users WHERE username=?').bind(username).first()
  if (exists) return error(409, 'Ese usuario ya existe')

  const email = `${username}@local`
  const password_hash = await hashPassword(password)

  await DB.prepare(`
    INSERT INTO users (email, username, password_hash, role, is_active)
    VALUES (?, ?, ?, ?, 1)
  `).bind(email, username, password_hash, role).run()

  return json({ ok: true, username, role, temp_password: password })
}
