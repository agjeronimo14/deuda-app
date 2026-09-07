import { json, error } from '../../_util/response.js'
import { sha256Base64Url } from '../../_util/crypto.js'
import { computeBalanceCents, computeBalanceEurCents, computeBalanceBtcSats } from '../../_util/db.js'

// This endpoint intentionally needs no session. The long random token is the credential,
// so it exposes only the debt report and never account, note, or counterparty details.
export async function onRequestGet(context) {
  const token = String(context.params.token || '').trim()
  if (!token || token.length < 20) return error(404, 'Enlace no encontrado')

  const { DB } = context.env
  const tokenHash = await sha256Base64Url(token)
  const link = await DB.prepare(`
    SELECT debt_id, is_active, expires_at
    FROM debt_public_links
    WHERE token_hash=?
  `).bind(tokenHash).first()

  if (!link || Number(link.is_active) !== 1) return error(404, 'Enlace no encontrado')
  if (link.expires_at && new Date(link.expires_at).getTime() <= Date.now()) {
    return error(410, 'Este enlace venció')
  }

  const debtId = Number(link.debt_id)
  const debt = await DB.prepare(`
    SELECT id, title, currency, principal_cents, principal_eur_cents, btc_sent_sats,
           due_date, status, created_at, updated_at
    FROM debts
    WHERE id=?
  `).bind(debtId).first()
  if (!debt) return error(404, 'Enlace no encontrado')

  const paymentsRes = await DB.prepare(`
    SELECT paid_at, amount_cents, eur_equiv_cents, btc_paid_sats, COALESCE(kind, 'PAYMENT') AS kind
    FROM payments
    WHERE debt_id=? AND confirmation_status='CONFIRMED'
    ORDER BY paid_at DESC, id DESC
  `).bind(debtId).all()

  const movements = (paymentsRes.results || []).map(p => ({
    paid_at: p.paid_at,
    amount_cents: Number(p.amount_cents),
    eur_equiv_cents: p.eur_equiv_cents == null ? null : Number(p.eur_equiv_cents),
    btc_paid_sats: p.btc_paid_sats == null ? null : Number(p.btc_paid_sats),
    kind: p.kind === 'CHARGE' ? 'CHARGE' : 'PAYMENT',
  }))

  const totals = movements.reduce((result, movement) => {
    if (movement.kind === 'CHARGE') result.charges_cents += movement.amount_cents
    else result.payments_cents += movement.amount_cents
    return result
  }, { payments_cents: 0, charges_cents: 0 })

  const [balance_cents, balance_eur_cents, balance_btc_sats] = await Promise.all([
    computeBalanceCents(DB, debtId),
    computeBalanceEurCents(DB, debtId),
    computeBalanceBtcSats(DB, debtId),
  ])

  return json({
    report: {
      title: debt.title,
      currency: debt.currency || 'USD',
      principal_cents: Number(debt.principal_cents),
      principal_eur_cents: debt.principal_eur_cents == null ? null : Number(debt.principal_eur_cents),
      btc_sent_sats: debt.btc_sent_sats == null ? null : Number(debt.btc_sent_sats),
      balance_cents: Number(balance_cents ?? 0),
      balance_eur_cents: balance_eur_cents == null ? null : Number(balance_eur_cents),
      balance_btc_sats: balance_btc_sats == null ? null : Number(balance_btc_sats),
      payments_cents: totals.payments_cents,
      charges_cents: totals.charges_cents,
      due_date: debt.due_date || null,
      status: debt.status,
      updated_at: debt.updated_at || debt.created_at,
      last_movement_at: movements[0]?.paid_at || null,
      expires_at: link.expires_at || null,
      movements,
    },
  }, { headers: { 'Cache-Control': 'private, no-store' } })
}
