import { json, error } from '../../_util/response.js'
import { requireUser } from '../../_util/auth.js'
import { updateDebtStatusIfPaid } from '../../_util/db.js'

async function fetchBtcRates() {
  const url = 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd,eur'
  const res = await fetch(url, { headers: { 'accept': 'application/json' } })
  if (!res.ok) throw new Error('rate_fetch_failed')
  const data = await res.json()
  const usd = Number(data?.bitcoin?.usd)
  const eur = Number(data?.bitcoin?.eur)
  if (!Number.isFinite(usd) || !Number.isFinite(eur)) throw new Error('rate_invalid')
  return { usd, eur }
}

export async function onRequestPost(context) {
  const { user, response } = await requireUser(context)
  if (response) return response

  const debtId = Number(context.params.id)
  if (!Number.isFinite(debtId)) return error(400, 'ID inválido')

  let body
  try { body = await context.request.json() } catch { return error(400, 'JSON inválido') }

  const paid_at = body.paid_at ? String(body.paid_at) : new Date().toISOString().slice(0,10)
  const note = body.note ? String(body.note) : null
  const kind = body.kind === 'CHARGE' ? 'CHARGE' : 'PAYMENT' // PAYMENT resta, CHARGE suma

  const { DB } = context.env
  const debt = await DB.prepare('SELECT * FROM debts WHERE id=?').bind(debtId).first()
  if (!debt) return error(404, 'No existe')

  const isAdmin = (user.role || 'user') === 'admin'
  const isOwner = Number(debt.owner_user_id) === Number(user.id)
  if (!isAdmin && !isOwner) return error(403, 'Solo owner o ADMIN')

  // Monto USD (cents) requerido (manual) o calculable si se manda BTC sin USD.
  let amount_cents = body.amount_cents != null ? Number(body.amount_cents) : null
  let eur_equiv_cents = body.eur_equiv_cents != null ? Number(body.eur_equiv_cents) : null

  if (amount_cents != null) {
    if (!Number.isFinite(amount_cents) || amount_cents <= 0) return error(400, 'Monto USD inválido')
  }
  if (eur_equiv_cents != null) {
    if (!Number.isFinite(eur_equiv_cents) || eur_equiv_cents <= 0) return error(400, 'Monto EUR inválido')
  }

  let btc_paid_sats = body.btc_paid_sats != null ? Number(body.btc_paid_sats) : null
  let btc_rate_usd_at_payment = null
  let btc_rate_eur_at_payment = null

  if (btc_paid_sats != null) {
    if (!Number.isFinite(btc_paid_sats) || btc_paid_sats <= 0) return error(400, 'BTC inválido (sats)')
    // Si no mandaron USD manual, intentamos calcular con tasa (fallback)
    if (amount_cents == null) {
      try {
        const r = await fetchBtcRates()
        btc_rate_usd_at_payment = r.usd
        btc_rate_eur_at_payment = r.eur
        const btc = btc_paid_sats / 100000000
        amount_cents = Math.round(btc * btc_rate_usd_at_payment * 100)
        if (eur_equiv_cents == null) eur_equiv_cents = Math.round(btc * btc_rate_eur_at_payment * 100)
      } catch {
        return error(502, 'No se pudo obtener la tasa BTC. Coloca USD manual.')
      }
    }
  }

  if (amount_cents == null) return error(400, 'Monto requerido')

  // Si hay contraparte con confirmación, queda PENDING
  let confirmation_status = 'CONFIRMED'
  const share = await DB.prepare(`
    SELECT can_confirm, accepted_at
    FROM debt_shares
    WHERE debt_id=?
    LIMIT 1
  `).bind(debtId).first()

  if (share && Number(share.can_confirm) === 1 && share.accepted_at) {
    confirmation_status = 'PENDING'
  }

  try {
    await DB.prepare(`
      INSERT INTO payments (
        debt_id, amount_cents, paid_at, note, confirmation_status, created_by_user_id,
        btc_paid_sats, btc_rate_usd_at_payment, btc_rate_eur_at_payment,
        kind, eur_equiv_cents
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      debtId, amount_cents, paid_at, note, confirmation_status, user.id,
      btc_paid_sats, btc_rate_usd_at_payment, btc_rate_eur_at_payment,
      kind, eur_equiv_cents
    ).run()
  } catch (e) {
    const msg = String(e?.message || e || '')
    if (msg.includes('no such column') || msg.includes('has no column')) {
      return error(500, 'Faltan migraciones. Ejecuta: npx wrangler d1 migrations apply <DB_NAME> --remote')
    }
    throw e
  }

  await updateDebtStatusIfPaid(DB, debtId)
  return json({ ok: true })
}
