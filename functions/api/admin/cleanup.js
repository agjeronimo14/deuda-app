import { json, error } from '../_util/response.js'
import { requireAdmin } from '../_util/auth.js'

export async function onRequestPost(context) {
  const { response } = await requireAdmin(context)
  if (response) return response

  let body
  try { body = await context.request.json() } catch { body = {} }

  const confirm = String(body.confirm || '')
  const scope = String(body.scope || 'DEBTS').toUpperCase()

  if (confirm !== 'DELETE') return error(400, 'Falta confirmación. Envía { confirm: "DELETE" }.')
  const { DB } = context.env

  if (scope === 'SESSIONS') {
    await DB.prepare('DELETE FROM sessions').run()
    return json({ ok: true, scope })
  }

  if (scope === 'PAYMENTS') {
    await DB.prepare('DELETE FROM payments').run()
    // no tocamos deudas
    return json({ ok: true, scope })
  }

  if (scope === 'DEBTS') {
    await DB.prepare('DELETE FROM payments').run()
    await DB.prepare('DELETE FROM debt_shares').run()
    await DB.prepare('DELETE FROM debts').run()
    return json({ ok: true, scope })
  }

  if (scope === 'ALL') {
    await DB.prepare('DELETE FROM payments').run()
    await DB.prepare('DELETE FROM debt_shares').run()
    await DB.prepare('DELETE FROM debts').run()
    await DB.prepare('DELETE FROM sessions').run()
    return json({ ok: true, scope })
  }

  return error(400, 'Scope inválido. Usa DEBTS, PAYMENTS, SESSIONS o ALL.')
}
