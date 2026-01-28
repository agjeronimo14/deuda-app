import { json, error } from '../_util/response.js'
import { requireUser } from '../_util/auth.js'
import { updateDebtStatusIfPaid } from '../_util/db.js'

export async function onRequestDelete(context) {
  const { user, response } = await requireUser(context)
  if (response) return response

  const paymentId = Number(context.params.id)
  if (!Number.isFinite(paymentId)) return error(400, 'ID inválido')

  const { DB } = context.env
  const p = await DB.prepare('SELECT id, debt_id, created_by_user_id FROM payments WHERE id=?').bind(paymentId).first()
  if (!p) return error(404, 'No existe')

  const debt = await DB.prepare('SELECT owner_user_id FROM debts WHERE id=?').bind(p.debt_id).first()
  if (!debt) return error(404, 'Deuda no existe')

  const isAdmin = (user.role || 'user') === 'admin'
  const isOwner = Number(debt.owner_user_id) === Number(user.id)

  // regla: solo ADMIN o owner puede borrar abonos (contraparte no)
  if (!isAdmin && !isOwner) return error(403, 'Solo owner o ADMIN')

  await DB.prepare('DELETE FROM payments WHERE id=?').bind(paymentId).run()
  await updateDebtStatusIfPaid(DB, Number(p.debt_id))
  return json({ ok: true })
}
