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

  const { DB } = context.env
  const debt = await DB.prepare('SELECT * FROM debts WHERE id=?').bind(debtId).first()
  if (!debt) return error(404, 'No existe')

  const isAdmin = (user.role || 'user') === 'admin'
  const isOwner = Number(debt.owner_user_id) === Number(user.id)
  if (!isAdmin && !isOwner) return error(403, 'Solo owner o ADMIN')

  // Determinar monto (USD cents) desde:
  // - manual: amount_cents
  // - btc: btc_paid_sats (se calcula USD a la tasa actual, pero el principal está anclado al día de envío)
  let amount_cents = null
  let btc_paid_sats = null
  let btc_rate_usd_at_payment = null
  let btc_rate_eur_at_payment = null

  if (body.btc_paid_sats != null) {
    btc_paid_sats = Number(body.btc_paid_sats)
    if (!Number.isFinite(btc_paid_sats) || btc_paid_sats <= 0) return error(400, 'BTC inválido (sats)')
    try {
      const r = await fetchBtcRates()
      btc_rate_usd_at_payment = r.usd
      btc_rate_eur_at_payment = r.eur
      const btc = btc_paid_sats / 100000000
      amount_cents = Math.round(btc * btc_rate_usd_at_payment * 100)
    } catch {
      return error(502, 'No se pudo obtener la tasa BTC para registrar este abono. Usa modo USD manual.')
    }
  } else {
    amount_cents = Number(body.amount_cents)
    if (!Number.isFinite(amount_cents) || amount_cents <= 0) return error(400, 'Monto inválido')
  }

  // Si hay contraparte con confirmación, el abono queda PENDING (en ambas direcciones)
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

  // Insert robusto: si no existe migración 0003, devolvemos error claro.
  try {
    await DB.prepare(`
      INSERT INTO payments (debt_id, amount_cents, paid_at, note, confirmation_status, created_by_user_id,
                            btc_paid_sats, btc_rate_usd_at_payment, btc_rate_eur_at_payment)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(debtId, amount_cents, paid_at, note, confirmation_status, user.id,
            btc_paid_sats, btc_rate_usd_at_payment, btc_rate_eur_at_payment).run()
  } catch (e) {
    const msg = String(e?.message || e || '')
    if (msg.includes('no such column') || msg.includes('has no column')) {
      return error(500, 'Falta aplicar migración 0003 (BTC). Ejecuta: npx wrangler d1 migrations apply <DB_NAME> --remote')
    }
    throw e
  }

  await updateDebtStatusIfPaid(DB, debtId)

  return json({ ok: true })
}
