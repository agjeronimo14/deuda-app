import { parseCookies, cookieString } from './cookies.js'
import { error } from './response.js'
import { randomToken } from './crypto.js'

function isHttps(url) {
  try { return new URL(url).protocol === 'https:' } catch { return false }
}

export async function getSessionUser(context) {
  const { request, env } = context
  const cookies = parseCookies(request)
  const sid = cookies.session
  if (!sid) return null

  let sess = null
  try {
    sess = await env.DB.prepare(`
      SELECT s.user_id, s.expires_at, u.email, u.username, u.role, u.is_active
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.id = ?
    `).bind(sid).first()
  } catch {
    // compat con DB vieja (sin role/is_active)
    sess = await env.DB.prepare(`
      SELECT s.user_id, s.expires_at, u.email, u.username
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.id = ?
    `).bind(sid).first()
  }

  if (!sess) return null
  if (new Date(sess.expires_at).getTime() <= Date.now()) {
    await env.DB.prepare('DELETE FROM sessions WHERE id=?').bind(sid).run()
    return null
  }

  return {
    id: Number(sess.user_id),
    email: sess.email,
    username: sess.username,
    role: sess.role || 'user',
    is_active: Number(sess.is_active ?? 1) === 1,
  }
}

export async function requireUser(context) {
  const user = await getSessionUser(context)
  if (!user) return { user: null, response: error(401, 'No autenticado') }
  if (!user.is_active) return { user: null, response: error(403, 'Usuario desactivado') }
  return { user, response: null }
}

export async function requireAdmin(context) {
  const { user, response } = await requireUser(context)
  if (response) return { user: null, response }
  if ((user.role || 'user') !== 'admin') return { user: null, response: error(403, 'Solo ADMIN') }
  return { user, response: null }
}

export async function createSession(context, userId) {
  const sid = randomToken(32)
  const days = 30
  const expires = new Date(Date.now() + days * 24*60*60*1000).toISOString()
  await context.env.DB.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)').bind(sid, userId, expires).run()

  const secure = isHttps(context.request.url)
  const cookie = cookieString('session', sid, {
    path: '/',
    httpOnly: true,
    sameSite: 'Lax',
    maxAge: days * 24*60*60,
    secure
  })
  return { sid, cookie }
}

export async function clearSession(context) {
  const cookies = parseCookies(context.request)
  const sid = cookies.session
  if (sid) {
    await context.env.DB.prepare('DELETE FROM sessions WHERE id=?').bind(sid).run()
  }
  const secure = isHttps(context.request.url)
  const cookie = cookieString('session', '', { path:'/', httpOnly:true, sameSite:'Lax', maxAge: 0, secure })
  return cookie
}
