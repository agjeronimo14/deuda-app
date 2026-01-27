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
  const paid_at = String(body.paid_at || '').trim()
  const note = body.note ? String(body.note).trim() : null

  if (!Number.isFinite(amount_cents) || amount_cents <= 0) return error(400, 'Monto inválido')
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(paid_at)) return error(400, 'Fecha inválida (YYYY-MM-DD)')

  const { DB } = context.env
  const debt = await DB.prepare('SELECT id, owner_user_id, direction FROM debts WHERE id=?').bind(debtId).first()
  if (!debt) return error(404, 'No existe')
  if (Number(debt.owner_user_id) !== Number(user.id)) return error(403, 'Solo owner puede registrar abonos')

  let confirmation_status = 'CONFIRMED'
  if (debt.direction === 'I_OWE') {
    const share = await DB.prepare('SELECT counterparty_user_id, can_confirm, accepted_at FROM debt_shares WHERE debt_id=?').bind(debtId).first()
    const canConfirm = share && Number(share.can_confirm) === 1 && share.counterparty_user_id && share.accepted_at
    if (canConfirm) confirmation_status = 'PENDING'
  }

  const res = await DB.prepare(`
    INSERT INTO payments (debt_id, created_by_user_id, amount_cents, paid_at, note, confirmation_status)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(debtId, user.id, amount_cents, paid_at, note, confirmation_status).run()

  await updateDebtStatusIfPaid(DB, debtId)

  return json({ ok: true, id: res.meta.last_row_id, confirmation_status })
}
