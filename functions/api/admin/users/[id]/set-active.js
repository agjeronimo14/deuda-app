import { json, error } from '../../../_util/response.js'
import { requireAdmin } from '../../../_util/auth.js'

export async function onRequestPost(context) {
  const { user, response } = await requireAdmin(context)
  if (response) return response

  const userId = Number(context.params.id)
  if (!Number.isFinite(userId)) return error(400, 'ID inválido')
  if (Number(userId) === Number(user.id)) return error(400, 'No puedes desactivarte a ti mismo.')

  let body
  try { body = await context.request.json() } catch { body = {} }
  const is_active = body.is_active ? 1 : 0

  const { DB } = context.env
  let u = null
  try { u = await DB.prepare('SELECT id, role FROM users WHERE id=?').bind(userId).first() } 
  catch { u = await DB.prepare('SELECT id FROM users WHERE id=?').bind(userId).first() }
  if (!u) return error(404, 'No existe')
  if ((u.role || '') === 'admin') return error(400, 'No puedes desactivar un admin.')

  await DB.prepare('UPDATE users SET is_active=? WHERE id=?').bind(is_active, userId).run()
  return json({ ok: true, id: userId, is_active: is_active === 1 })
}
