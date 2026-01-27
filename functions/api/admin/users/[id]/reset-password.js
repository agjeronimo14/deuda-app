import { json, error } from '../../../_util/response.js'
import { requireAdmin } from '../../../_util/auth.js'
import { hashPassword } from '../../../_util/crypto.js'

function randomPassword(len=10){
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  let out = ''
  for (let i=0;i<len;i++) out += chars[Math.floor(Math.random()*chars.length)]
  return out
}

export async function onRequestPost(context) {
  const { user, response } = await requireAdmin(context)
  if (response) return response

  const userId = Number(context.params.id)
  if (!Number.isFinite(userId)) return error(400, 'ID inválido')
  if (Number(userId) === Number(user.id)) return error(400, 'No puedes resetear tu propia contraseña desde aquí.')

  const password = randomPassword(10)
  const password_hash = await hashPassword(password)

  const { DB } = context.env
  const u = await DB.prepare('SELECT id FROM users WHERE id=?').bind(userId).first()
  if (!u) return error(404, 'No existe')

  await DB.prepare('UPDATE users SET password_hash=? WHERE id=?').bind(password_hash, userId).run()
  return json({ ok: true, id: userId, temp_password: password })
}
