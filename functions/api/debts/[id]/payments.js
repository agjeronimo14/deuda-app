import { json, error } from '../../_util/response.js'
import { requireUser } from '../../_util/auth.js'
import { updateDebtStatusIfPaid } from '../../_util/db.js'

export async function onRequestPost(context) {
  const { user, response } = await requireUser(context)
  if (response) return response

  const debtId = Number(context.params.id)
  if (!Number.isFinite(debtId)) return error(400, 'ID inválido')

  let body
  try { body = await context.request.json() } catch { return error(400, 'JSON inválido') }

  const amount_cents = Number(body.amount_cents)
  const paid_at = body.paid_at ? String(body.paid_at) : new Date().toISOString().slice(0,10)
  const note = body.note ? String(body.note) : null

  if (!Number.isFinite(amount_cents) || amount_cents <= 0) return error(400, 'Monto inválido')

  const { DB } = context.env
  const debt = await DB.prepare('SELECT * FROM debts WHERE id=?').bind(debtId).first()
  if (!debt) return error(404, 'No existe')

  const isAdmin = (user.role || 'user') === 'admin'
  const isOwner = Number(debt.owner_user_id) === Number(user.id)
  if (!isAdmin && !isOwner) return error(403, 'Solo owner o ADMIN')

  // regla: si es "Yo debo" y hay contraparte con confirmación, queda PENDING
  let confirmation_status = 'CONFIRMED'
  const share = await DB.prepare(`
    SELECT can_confirm, accepted_at
    FROM debt_shares
    WHERE debt_id=?
    LIMIT 1
  `).bind(debtId).first()

  if (debt.direction === 'I_OWE' && share && Number(share.can_confirm) === 1 && share.accepted_at) {
    confirmation_status = 'PENDING'
  }

  await DB.prepare(`
    INSERT INTO payments (debt_id, amount_cents, paid_at, note, confirmation_status, created_by_user_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(debtId, amount_cents, paid_at, note, confirmation_status, user.id).run()

  await updateDebtStatusIfPaid(DB, debtId)

  return json({ ok: true })
}
