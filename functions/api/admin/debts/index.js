import { json } from '../../_util/response.js'
import { requireAdmin } from '../../_util/auth.js'
import { computeBalanceCents } from '../../_util/db.js'

export async function onRequestGet(context) {
  const { response } = await requireAdmin(context)
  if (response) return response

  const { DB } = context.env
  const res = await DB.prepare(`
    SELECT d.id, d.title, d.direction, d.currency, d.principal_cents, d.due_date, d.status, d.created_at,
           ou.username AS owner_username,
           cu.username AS counterparty_username
    FROM debts d
    JOIN users ou ON ou.id = d.owner_user_id
    LEFT JOIN debt_shares s ON s.debt_id = d.id
    LEFT JOIN users cu ON cu.id = s.counterparty_user_id
    ORDER BY d.id DESC
    LIMIT 500
  `).all()

  const rows = res.results || []
  const out = []
  for (const r of rows) {
    const bal = await computeBalanceCents(DB, r.id)
    out.push({
      id: Number(r.id),
      title: r.title,
      direction: r.direction,
      currency: r.currency,
      principal_cents: Number(r.principal_cents),
      due_date: r.due_date,
      status: r.status,
      created_at: r.created_at,
      owner_username: r.owner_username,
      counterparty_username: r.counterparty_username || null,
      balance_cents: Number(bal ?? 0),
    })
  }

  return json({ debts: out })
}
