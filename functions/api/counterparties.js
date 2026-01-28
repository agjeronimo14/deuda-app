import { json, error } from './_util/response.js'
import { requireUser } from './_util/auth.js'

export async function onRequestGet(context) {
  const { user, response } = await requireUser(context)
  if (response) return response

  const { DB } = context.env
  let res
  try {
    res = await DB.prepare(`
      SELECT id, username, role
      FROM users
      WHERE is_active = 1
        AND role = 'counterparty'
      ORDER BY username ASC
    `).all()
  } catch {
    // compat DB vieja
    res = await DB.prepare(`
      SELECT id, username
      FROM users
      ORDER BY username ASC
    `).all()
  }

  return json({
    users: (res.results || []).map(u => ({
      id: Number(u.id),
      username: u.username,
      role: u.role || 'user',
    }))
  })
}
