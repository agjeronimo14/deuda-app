import { json, error } from '../../_util/response.js'
import { requireUser } from '../../_util/auth.js'
import { randomToken, sha256Base64Url } from '../../_util/crypto.js'

async function requireDebtEditor(context) {
  const { user, response } = await requireUser(context)
  if (response) return { response }

  const debtId = Number(context.params.id)
  if (!Number.isFinite(debtId)) return { response: error(400, 'ID inválido') }

  const { DB } = context.env
  const debt = await DB.prepare('SELECT id, owner_user_id FROM debts WHERE id=?').bind(debtId).first()
  if (!debt) return { response: error(404, 'No existe') }

  const isAdmin = (user.role || 'user') === 'admin'
  const isOwner = Number(debt.owner_user_id) === Number(user.id)
  if (!isAdmin && !isOwner) return { response: error(403, 'Solo owner o ADMIN') }

  return { user, debtId, DB, response: null }
}

export async function onRequestGet(context) {
  const access = await requireDebtEditor(context)
  if (access.response) return access.response

  const row = await access.DB.prepare(`
    SELECT is_active, expires_at, created_at, updated_at
    FROM debt_public_links
    WHERE debt_id=?
  `).bind(access.debtId).first()

  return json({
    link: row ? {
      is_active: Number(row.is_active) === 1,
      expires_at: row.expires_at || null,
      created_at: row.created_at,
      updated_at: row.updated_at,
    } : null,
  })
}

export async function onRequestPost(context) {
  const access = await requireDebtEditor(context)
  if (access.response) return access.response

  let body
  try { body = await context.request.json() } catch { body = {} }

  const requestedDays = body.expires_in_days == null || body.expires_in_days === ''
    ? 90
    : Number(body.expires_in_days)
  const allowedDays = new Set([0, 7, 30, 90, 365])
  if (!allowedDays.has(requestedDays)) {
    return error(400, 'Vencimiento inválido')
  }

  const expires_at = requestedDays === 0
    ? null
    : new Date(Date.now() + requestedDays * 24 * 60 * 60 * 1000).toISOString()
  const token = randomToken(32)
  const token_hash = await sha256Base64Url(token)
  const existing = await access.DB.prepare('SELECT id FROM debt_public_links WHERE debt_id=?').bind(access.debtId).first()

  if (existing) {
    await access.DB.prepare(`
      UPDATE debt_public_links
      SET token_hash=?, is_active=1, expires_at=?, created_by_user_id=?, updated_at=datetime('now')
      WHERE debt_id=?
    `).bind(token_hash, expires_at, access.user.id, access.debtId).run()
  } else {
    await access.DB.prepare(`
      INSERT INTO debt_public_links (debt_id, token_hash, is_active, expires_at, created_by_user_id)
      VALUES (?, ?, 1, ?, ?)
    `).bind(access.debtId, token_hash, expires_at, access.user.id).run()
  }

  return json({ ok: true, token, path: `/r/${token}`, expires_at })
}

export async function onRequestDelete(context) {
  const access = await requireDebtEditor(context)
  if (access.response) return access.response

  await access.DB.prepare(`
    UPDATE debt_public_links
    SET is_active=0, updated_at=datetime('now')
    WHERE debt_id=?
  `).bind(access.debtId).run()

  return json({ ok: true })
}
