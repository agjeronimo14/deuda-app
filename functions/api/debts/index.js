import { json, error } from '../_util/response.js'
import { requireUser } from '../_util/auth.js'
import { computeBalanceCents } from '../_util/db.js'

export async function onRequestGet(context) {
  const { user, response } = await requireUser(context)
  if (response) return response

  const { DB } = context.env

  const ownedRes = await DB.prepare(`
    SELECT id, direction, title, counterparty_name, currency, principal_cents, due_date, status, created_at
    FROM debts
    WHERE owner_user_id = ?
    ORDER BY created_at DESC
  `).bind(user.id).all()

  const sharedRes = await DB.prepare(`
    SELECT d.id, d.direction, d.title, d.counterparty_name, d.currency, d.principal_cents, d.due_date, d.status, d.created_at
    FROM debts d
    JOIN debt_shares s ON s.debt_id = d.id
    WHERE s.counterparty_user_id = ?
    ORDER BY d.created_at DESC
  `).bind(user.id).all()

  async function attachBalance(rows) {
    const out = []
    for (const r of rows) {
      const bal = await computeBalanceCents(DB, r.id)
      out.push({ ...r, principal_cents: Number(r.principal_cents), balance_cents: Number(bal ?? 0) })
    }
    return out
  }

  return json({
    owned: await attachBalance(ownedRes.results || []),
    shared: await attachBalance(sharedRes.results || []),
  })
}

export async function onRequestPost(context) {
  const { user, response } = await requireUser(context)
  if (response) return response

  let body
  try { body = await context.request.json() } catch { return error(400, 'JSON inválido') }

  const title = String(body.title || '').trim()
  const counterparty_name = body.counterparty_name ? String(body.counterparty_name).trim() : null
  const direction = body.direction === 'OWED_TO_ME' ? 'OWED_TO_ME' : 'I_OWE'
  const currency = body.currency ? String(body.currency).toUpperCase() : 'USD'
  const principal_cents = Number(body.principal_cents)
  const due_date = body.due_date ? String(body.due_date) : null
  const notes = body.notes ? String(body.notes) : null

  if (!title) return error(400, 'Título requerido')
  if (!Number.isFinite(principal_cents) || principal_cents <= 0) return error(400, 'Monto inválido')

  const { DB } = context.env
  const res = await DB.prepare(`
    INSERT INTO debts (owner_user_id, direction, title, counterparty_name, currency, principal_cents, due_date, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(user.id, direction, title, counterparty_name, currency, principal_cents, due_date, notes).run()

  return json({ ok: true, id: res.meta.last_row_id })
}
