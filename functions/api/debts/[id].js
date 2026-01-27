import { json, error } from '../_util/response.js'
import { requireUser } from '../_util/auth.js'
import { computeBalanceCents } from '../_util/db.js'

async function getDebtAccess(DB, debtId, userId) {
  const debt = await DB.prepare('SELECT * FROM debts WHERE id=?').bind(debtId).first()
  if (!debt) return { debt: null, access: null, share: null }

  if (Number(debt.owner_user_id) === Number(userId)) {
    const share = await DB.prepare(`
      SELECT s.*, u.username AS counterparty_username
      FROM debt_shares s
      LEFT JOIN users u ON u.id = s.counterparty_user_id
      WHERE s.debt_id=?
    `).bind(debtId).first()
    return { debt, access:'OWNER', share }
  }

  const share = await DB.prepare(`
    SELECT s.*, u.username AS counterparty_username
    FROM debt_shares s
    LEFT JOIN users u ON u.id = s.counterparty_user_id
    WHERE s.debt_id=? AND s.counterparty_user_id=?
  `).bind(debtId, userId).first()

  if (share) return { debt, access:'COUNTERPARTY', share }
  return { debt, access:null, share:null }
}

export async function onRequestGet(context) {
  const { user, response } = await requireUser(context)
  if (response) return response

  const debtId = Number(context.params.id)
  if (!Number.isFinite(debtId)) return error(400, 'ID inválido')

  const { DB } = context.env
  const { debt, access, share } = await getDebtAccess(DB, debtId, user.id)
  if (!debt) return error(404, 'No existe')
  if (!access) return error(403, 'Sin acceso')

  const paymentsRes = await DB.prepare(`
    SELECT id, amount_cents, paid_at, note, confirmation_status, confirmed_at, confirmation_note, created_at
    FROM payments
    WHERE debt_id=?
    ORDER BY paid_at DESC, id DESC
  `).bind(debtId).all()

  const balance_cents = await computeBalanceCents(DB, debtId)

  return json({
    access,
    debt: {
      ...debt,
      id: Number(debt.id),
      owner_user_id: Number(debt.owner_user_id),
      principal_cents: Number(debt.principal_cents),
    },
    share: share ? {
      ...share,
      id: Number(share.id),
      can_confirm: Number(share.can_confirm) === 1,
      counterparty_user_id: share.counterparty_user_id ? Number(share.counterparty_user_id) : null,
      counterparty_username: share.counterparty_username || null,
    } : null,
    balance_cents: Number(balance_cents ?? 0),
    payments: (paymentsRes.results || []).map(p => ({
      ...p,
      id: Number(p.id),
      amount_cents: Number(p.amount_cents),
    }))
  })
}

export async function onRequestPut(context) {
  const { user, response } = await requireUser(context)
  if (response) return response

  const debtId = Number(context.params.id)
  if (!Number.isFinite(debtId)) return error(400, 'ID inválido')

  let body
  try { body = await context.request.json() } catch { return error(400, 'JSON inválido') }

  const { DB } = context.env
  const debt = await DB.prepare('SELECT * FROM debts WHERE id=?').bind(debtId).first()
  if (!debt) return error(404, 'No existe')
  if (Number(debt.owner_user_id) !== Number(user.id)) return error(403, 'Solo owner')

  const title = body.title != null ? String(body.title).trim() : debt.title
  const counterparty_name = body.counterparty_name != null ? String(body.counterparty_name).trim() : debt.counterparty_name
  const due_date = body.due_date !== undefined ? (body.due_date ? String(body.due_date) : null) : debt.due_date
  const notes = body.notes !== undefined ? (body.notes ? String(body.notes) : null) : debt.notes
  const status = body.status ? String(body.status) : debt.status

  await DB.prepare(`
    UPDATE debts SET title=?, counterparty_name=?, due_date=?, notes=?, status=?, updated_at=datetime('now')
    WHERE id=?
  `).bind(title, counterparty_name, due_date, notes, status, debtId).run()

  return json({ ok: true })
}
