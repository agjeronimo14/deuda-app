import { json, error } from '../../_util/response.js'
import { requireUser } from '../../_util/auth.js'
import { updateDebtStatusIfPaid } from '../../_util/db.js'

export async function onRequestPost(context) {
  const { user, response } = await requireUser(context)
  if (response) return response

  const paymentId = Number(context.params.id)
  if (!Number.isFinite(paymentId)) return error(400, 'ID inválido')

  const { DB } = context.env

  const p = await DB.prepare('SELECT * FROM payments WHERE id=?').bind(paymentId).first()
  if (!p) return error(404, 'No existe')

  const debt = await DB.prepare('SELECT * FROM debts WHERE id=?').bind(p.debt_id).first()
  if (!debt) return error(404, 'Deuda no existe')

  const isAdmin = (user.role || 'user') === 'admin'

  const share = await DB.prepare('SELECT * FROM debt_shares WHERE debt_id=?').bind(p.debt_id).first()

  // Solo aplica confirmación si la deuda es "Yo debo"
  if (debt.direction !== 'I_OWE') return error(400, 'No requiere confirmación')

  // ADMIN puede forzar; si no, solo la contraparte asignada
  if (!isAdmin) {
    if (!share) return error(403, 'Sin contraparte')
    if (Number(share.counterparty_user_id) !== Number(user.id)) return error(403, 'No eres la contraparte')
    if (Number(share.can_confirm) !== 1) return error(403, 'No tienes permiso de confirmar')
    if (!share.accepted_at) return error(403, 'No está activa')
  }

  // Solo pendientes pueden cambiar
  if (p.confirmation_status !== 'PENDING') return error(400, 'Este abono no está pendiente')

  await DB.prepare(`
    UPDATE payments
    SET confirmation_status = ?, confirmed_at = datetime('now')
    WHERE id = ?
  `).bind('CONFIRMED', paymentId).run()

  await updateDebtStatusIfPaid(DB, Number(p.debt_id))

  return json({ ok: true })
}
