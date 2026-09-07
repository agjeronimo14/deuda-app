import { json, error } from '../../_util/response.js'
import { requireUser } from '../../_util/auth.js'
import { updateDebtStatusIfPaid } from '../../_util/db.js'

// Lets the owner settle legacy pending movements without needing to sign in as the counterparty.
export async function onRequestPost(context) {
  const { user, response } = await requireUser(context)
  if (response) return response

  const debtId = Number(context.params.id)
  if (!Number.isFinite(debtId)) return error(400, 'ID inválido')

  const { DB } = context.env
  const debt = await DB.prepare('SELECT owner_user_id FROM debts WHERE id=?').bind(debtId).first()
  if (!debt) return error(404, 'No existe')

  const isAdmin = (user.role || 'user') === 'admin'
  const isOwner = Number(debt.owner_user_id) === Number(user.id)
  if (!isAdmin && !isOwner) return error(403, 'Solo owner o ADMIN')

  const result = await DB.prepare(`
    UPDATE payments
    SET confirmation_status='CONFIRMED', confirmed_by_user_id=?, confirmed_at=datetime('now')
    WHERE debt_id=? AND confirmation_status='PENDING'
  `).bind(user.id, debtId).run()

  await updateDebtStatusIfPaid(DB, debtId)
  return json({ ok: true, confirmed: Number(result.meta?.changes || 0) })
}
