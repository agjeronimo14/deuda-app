import { json, error } from '../_util/response.js'
import { requireUser } from '../_util/auth.js'
import { computeBalanceCents, computeBalanceEurCents, computeBalanceBtcSats, updateDebtStatusIfPaid } from '../_util/db.js'
import { randomToken, sha256Base64Url } from '../_util/crypto.js'

async function getDebtAccess(DB, debtId, user) {
  const debt = await DB.prepare('SELECT * FROM debts WHERE id=?').bind(debtId).first()
  if (!debt) return { debt: null, access: null, share: null, owner_username: null }

  const owner = await DB.prepare('SELECT username FROM users WHERE id=?').bind(debt.owner_user_id).first()
  const owner_username = owner?.username || null

  // ADMIN: acceso total
  if ((user.role || 'user') === 'admin') {
    const share = await DB.prepare(`
      SELECT s.*, u.username AS counterparty_username
      FROM debt_shares s
      LEFT JOIN users u ON u.id = s.counterparty_user_id
      WHERE s.debt_id=?
    `).bind(debtId).first()
    return { debt, access:'ADMIN', share, owner_username }
  }

  if (Number(debt.owner_user_id) === Number(user.id)) {
    const share = await DB.prepare(`
      SELECT s.*, u.username AS counterparty_username
      FROM debt_shares s
      LEFT JOIN users u ON u.id = s.counterparty_user_id
      WHERE s.debt_id=?
    `).bind(debtId).first()
    return { debt, access:'OWNER', share, owner_username }
  }

  const share = await DB.prepare(`
    SELECT s.*, u.username AS counterparty_username
    FROM debt_shares s
    LEFT JOIN users u ON u.id = s.counterparty_user_id
    WHERE s.debt_id=? AND s.counterparty_user_id=?
  `).bind(debtId, user.id).first()

  if (share) return { debt, access:'COUNTERPARTY', share, owner_username }
  return { debt, access:null, share:null, owner_username }
}

export async function onRequestGet(context) {
  const { user, response } = await requireUser(context)
  if (response) return response

  const debtId = Number(context.params.id)
  if (!Number.isFinite(debtId)) return error(400, 'ID inválido')

  const { DB } = context.env
  const { debt, access, share, owner_username } = await getDebtAccess(DB, debtId, user)
  if (!debt) return error(404, 'No existe')
  if (!access) return error(403, 'Sin acceso')

  const paymentsRes = await DB.prepare(`
    SELECT *
    FROM payments
    WHERE debt_id=?
    ORDER BY paid_at DESC, id DESC
  `).bind(debtId).all()

  const balance_cents = await computeBalanceCents(DB, debtId)
  const balance_eur_cents = await computeBalanceEurCents(DB, debtId)
  const balance_btc_sats = await computeBalanceBtcSats(DB, debtId)

  return json({
    access,
    owner_username,
    debt: {
      ...debt,
      id: Number(debt.id),
      owner_user_id: Number(debt.owner_user_id),
      principal_cents: Number(debt.principal_cents),
      principal_eur_cents: debt.principal_eur_cents == null ? null : Number(debt.principal_eur_cents),
      btc_sent_sats: debt.btc_sent_sats == null ? null : Number(debt.btc_sent_sats),
      btc_rate_usd_at_send: debt.btc_rate_usd_at_send == null ? null : Number(debt.btc_rate_usd_at_send),
      btc_rate_eur_at_send: debt.btc_rate_eur_at_send == null ? null : Number(debt.btc_rate_eur_at_send),
    },
    share: share ? {
      ...share,
      id: Number(share.id),
      can_confirm: Number(share.can_confirm) === 1,
      counterparty_user_id: share.counterparty_user_id ? Number(share.counterparty_user_id) : null,
      counterparty_username: share.counterparty_username || null,
    } : null,
    balance_cents: Number(balance_cents ?? 0),
    balance_eur_cents: balance_eur_cents == null ? null : Number(balance_eur_cents),
    balance_btc_sats: balance_btc_sats == null ? null : Number(balance_btc_sats),
    payments: (paymentsRes.results || []).map(p => ({
      ...p,
      id: Number(p.id),
      amount_cents: Number(p.amount_cents),
      btc_paid_sats: p.btc_paid_sats == null ? null : Number(p.btc_paid_sats),
      btc_rate_usd_at_payment: p.btc_rate_usd_at_payment == null ? null : Number(p.btc_rate_usd_at_payment),
      btc_rate_eur_at_payment: p.btc_rate_eur_at_payment == null ? null : Number(p.btc_rate_eur_at_payment),
      eur_equiv_cents: p.eur_equiv_cents == null ? null : Number(p.eur_equiv_cents),
      kind: p.kind || 'PAYMENT',
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

  const isAdmin = (user.role || 'user') === 'admin'
  const isOwner = Number(debt.owner_user_id) === Number(user.id)
  if (!isAdmin && !isOwner) return error(403, 'Solo owner o ADMIN')

  const title = body.title != null ? String(body.title).trim() : debt.title
  const counterparty_name = body.counterparty_name != null ? String(body.counterparty_name).trim() : debt.counterparty_name
  const due_date = body.due_date !== undefined ? (body.due_date ? String(body.due_date) : null) : debt.due_date
  const notes = body.notes !== undefined ? (body.notes ? String(body.notes) : null) : debt.notes
  const status = body.status ? String(body.status) : debt.status
  const requires_confirmation = body.requires_confirmation !== undefined
    ? (body.requires_confirmation === true ? 1 : 0)
    : (Number(debt.requires_confirmation) === 1 ? 1 : 0)

  // BTC/EUR (solo aplica a "Me deben")
  const canUpdateBtc = String(debt.direction || '') === 'OWED_TO_ME'

  const principal_eur_cents_upd = (body.principal_eur_cents !== undefined)
    ? (body.principal_eur_cents == null || body.principal_eur_cents === '' ? null : Number(body.principal_eur_cents))
    : debt.principal_eur_cents

  const btc_sent_sats_upd = (body.btc_sent_sats !== undefined)
    ? (body.btc_sent_sats == null || body.btc_sent_sats === '' ? null : Number(body.btc_sent_sats))
    : debt.btc_sent_sats

  const amount_mode_upd = (body.amount_mode !== undefined)
    ? (String(body.amount_mode) === 'btc_anchored_usd' ? 'btc_anchored_usd' : 'manual_usd')
    : (debt.amount_mode || 'manual_usd')

  const eurFinal = (canUpdateBtc && Number.isFinite(Number(principal_eur_cents_upd)) && Number(principal_eur_cents_upd) > 0)
    ? Number(principal_eur_cents_upd)
    : (canUpdateBtc ? null : debt.principal_eur_cents)

  const btcFinal = (canUpdateBtc && Number.isFinite(Number(btc_sent_sats_upd)) && Number(btc_sent_sats_upd) > 0)
    ? Number(btc_sent_sats_upd)
    : (canUpdateBtc ? null : debt.btc_sent_sats)

  let modeFinal = canUpdateBtc ? amount_mode_upd : (debt.amount_mode || 'manual_usd')
  if (!canUpdateBtc) modeFinal = (debt.amount_mode || 'manual_usd')

  await DB.prepare(`
    UPDATE debts SET
      title=?, counterparty_name=?, due_date=?, notes=?, status=?,
      principal_eur_cents=?, btc_sent_sats=?, amount_mode=?,
      requires_confirmation=?,
      updated_at=datetime('now')
    WHERE id=?
  `).bind(
    title, counterparty_name, due_date, notes, status,
    eurFinal, btcFinal, modeFinal, requires_confirmation,
    debtId
  ).run()

  // (Opcional) vincular/cambiar contraparte por username
  if (body.counterparty_username !== undefined) {
    const username = body.counterparty_username ? String(body.counterparty_username).trim().toLowerCase() : null

    const existing = await DB.prepare('SELECT * FROM debt_shares WHERE debt_id=?').bind(debtId).first()

    if (!username) {
      // unlink
      if (existing) {
        await DB.prepare('DELETE FROM debt_shares WHERE debt_id=?').bind(debtId).run()
      }
    } else {
      const u = await DB.prepare(`
        SELECT id, username, role, is_active
        FROM users
        WHERE lower(username)=lower(?)
        LIMIT 1
      `).bind(username).first()

      if (!u) return error(400, 'La contraparte no existe. Pide al ADMIN que cree ese usuario.')
      if (Number(u.is_active ?? 1) !== 1) return error(400, 'La contraparte está desactivada.')
      if ((u.role || 'user') === 'admin') return error(400, 'No puedes asignar ADMIN como contraparte.')

      const can_confirm = 1

      if (existing) {
        await DB.prepare(`
          UPDATE debt_shares
          SET counterparty_user_id=?, can_confirm=?, accepted_at=datetime('now')
          WHERE debt_id=?
        `).bind(Number(u.id), can_confirm, debtId).run()
      } else {
        const dummy = await sha256Base64Url(randomToken(24))
        await DB.prepare(`
          INSERT INTO debt_shares (debt_id, owner_user_id, counterparty_user_id, invite_token_hash, invite_expires_at, can_confirm, accepted_at)
          VALUES (?, ?, ?, ?, NULL, ?, datetime('now'))
        `).bind(debtId, Number(debt.owner_user_id), Number(u.id), dummy, can_confirm).run()
      }
    }
  }

  await updateDebtStatusIfPaid(DB, debtId)
  return json({ ok: true })
}

export async function onRequestDelete(context) {
  const { user, response } = await requireUser(context)
  if (response) return response

  const debtId = Number(context.params.id)
  if (!Number.isFinite(debtId)) return error(400, 'ID inválido')

  const { DB } = context.env
  const debt = await DB.prepare('SELECT id, owner_user_id FROM debts WHERE id=?').bind(debtId).first()
  if (!debt) return error(404, 'No existe')

  const isAdmin = (user.role || 'user') === 'admin'
  const isOwner = Number(debt.owner_user_id) === Number(user.id)
  if (!isAdmin && !isOwner) return error(403, 'Solo owner o ADMIN')

  // borrar en orden para no romper referencias
  await DB.prepare('DELETE FROM payments WHERE debt_id=?').bind(debtId).run()
  await DB.prepare('DELETE FROM debt_shares WHERE debt_id=?').bind(debtId).run()
  await DB.prepare('DELETE FROM debts WHERE id=?').bind(debtId).run()

  return json({ ok: true })
}
