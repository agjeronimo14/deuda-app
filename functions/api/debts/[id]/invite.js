import { json, error } from '../../_util/response.js'
import { requireUser } from '../../_util/auth.js'
import { randomToken, sha256Base64Url } from '../../_util/crypto.js'

export async function onRequestPost(context) {
  const { user, response } = await requireUser(context)
  if (response) return response

  const debtId = Number(context.params.id)
  if (!Number.isFinite(debtId)) return error(400, 'ID inválido')

  const { DB } = context.env
  const debt = await DB.prepare('SELECT id, owner_user_id FROM debts WHERE id=?').bind(debtId).first()
  if (!debt) return error(404, 'No existe')
  if (Number(debt.owner_user_id) !== Number(user.id)) return error(403, 'Solo owner')

  const token = randomToken(24)
  const token_hash = await sha256Base64Url(token)
  const expires = new Date(Date.now() + 7*24*60*60*1000).toISOString()

  const existing = await DB.prepare('SELECT id FROM debt_shares WHERE debt_id=?').bind(debtId).first()
  if (existing) {
    await DB.prepare(`
      UPDATE debt_shares
      SET invite_token_hash=?, invite_expires_at=?, accepted_at=NULL, counterparty_user_id=NULL
      WHERE debt_id=?
    `).bind(token_hash, expires, debtId).run()
  } else {
    await DB.prepare(`
      INSERT INTO debt_shares (debt_id, owner_user_id, invite_token_hash, invite_expires_at, can_confirm)
      VALUES (?, ?, ?, ?, 1)
    `).bind(debtId, user.id, token_hash, expires).run()
  }

  return json({ ok: true, token, expires_at: expires })
}
