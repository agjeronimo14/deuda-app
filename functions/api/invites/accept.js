import { json, error } from '../_util/response.js'
import { requireUser } from '../_util/auth.js'
import { sha256Base64Url } from '../_util/crypto.js'

export async function onRequestPost(context) {
  const { user, response } = await requireUser(context)
  if (response) return response

  let body
  try { body = await context.request.json() } catch { return error(400, 'JSON inválido') }

  const token = String(body.token || '').trim()
  if (!token) return error(400, 'Token requerido')

  const token_hash = await sha256Base64Url(token)
  const { DB } = context.env

  const share = await DB.prepare(`
    SELECT id, debt_id, invite_expires_at
    FROM debt_shares
    WHERE invite_token_hash = ?
  `).bind(token_hash).first()

  if (!share) return error(404, 'Invite inválido')
  if (share.invite_expires_at && new Date(share.invite_expires_at).getTime() <= Date.now()) {
    return error(410, 'Invite expirado')
  }

  await DB.prepare(`
    UPDATE debt_shares
    SET counterparty_user_id=?, accepted_at=datetime('now')
    WHERE id=?
  `).bind(user.id, share.id).run()

  return json({ ok: true, debt_id: Number(share.debt_id) })
}
