import { json, error } from '../../_util/response.js'
import { requireUser } from '../../_util/auth.js'
import { updateDebtStatusIfPaid } from '../../_util/db.js'

export async function onRequestPost(context) {
  const { user, response } = await requireUser(context)
  if (response) return response

  const paymentId = Number(context.params.id)
  if (!Number.isFinite(paymentId)) return error(400, 'ID inválido')

  let body
  try { body = await context.request.json() } catch { body = {} }
  const note = body.note ? String(body.note).trim() : null

  const { DB } = context.env
  const p = await DB.prepare(`
    SELECT p.id, p.debt_id, p.confirmation_status, d.direction, s.counterparty_user_id
    FROM payments p
    JOIN debts d ON d.id = p.debt_id
    LEFT JOIN debt_shares s ON s.debt_id = d.id
    WHERE p.id = ?
  `).bind(paymentId).first()

  if (!p) return error(404, 'No existe')
  if (p.confirmation_status !== 'PENDING') return error(400, 'Este abono no está pendiente')
  if (p.direction === 'I_OWE' && Number(p.counterparty_user_id) !== Number(user.id)) return error(403, 'Solo la contraparte puede rechazar')

  await DB.prepare(`
    UPDATE payments
    SET confirmation_status='REJECTED', confirmed_by_user_id=?, confirmed_at=datetime('now'), confirmation_note=?
    WHERE id=?
  `).bind(user.id, note, paymentId).run()

  await updateDebtStatusIfPaid(DB, Number(p.debt_id))
  return json({ ok: true })
}
