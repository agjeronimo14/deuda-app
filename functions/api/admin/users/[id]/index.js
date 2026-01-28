import { json, error } from '../../../_util/response.js'
import { requireAdmin } from '../../../_util/auth.js'

export async function onRequestDelete(context) {
  const { user: admin, response } = await requireAdmin(context)
  if (response) return response

  const id = Number(context.params.id)
  if (!Number.isFinite(id) || id <= 0) return error(400, 'ID inválido')
  if (id === admin.id) return error(400, 'No puedes eliminar tu propio usuario')

  const { DB } = context.env

  const target = await DB.prepare('SELECT id, username, role FROM users WHERE id=?').bind(id).first()
  if (!target) return error(404, 'Usuario no existe')

  // No permitir borrar el último ADMIN
  if (String(target.role || 'user').toLowerCase() === 'admin') {
    const admins = await DB.prepare("SELECT COUNT(1) AS c FROM users WHERE lower(role)='admin'").first()
    const c = Number(admins?.c ?? 0)
    if (c <= 1) return error(400, 'No puedes eliminar el último ADMIN')
  }

  // 1) Sesiones
  await DB.prepare('DELETE FROM sessions WHERE user_id=?').bind(id).run()

  // 2) Pagos creados/confirmados por este user (se eliminan)
  await DB.prepare('DELETE FROM payments WHERE created_by_user_id=? OR confirmed_by_user_id=?').bind(id, id).run()

  // 3) Deudas donde es owner (borrar pagos+shares y luego deuda)
  const owned = await DB.prepare('SELECT id FROM debts WHERE owner_user_id=?').bind(id).all()
  for (const r of (owned.results || [])) {
    const debtId = Number(r.id)
    await DB.prepare('DELETE FROM payments WHERE debt_id=?').bind(debtId).run()
    await DB.prepare('DELETE FROM debt_shares WHERE debt_id=?').bind(debtId).run()
    await DB.prepare('DELETE FROM debts WHERE id=?').bind(debtId).run()
  }

  // 4) Shares donde es contraparte
  await DB.prepare('DELETE FROM debt_shares WHERE counterparty_user_id=? OR owner_user_id=?').bind(id, id).run()

  // 5) Finalmente usuario
  await DB.prepare('DELETE FROM users WHERE id=?').bind(id).run()

  return json({ ok: true })
}
