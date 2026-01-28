import { json, error } from '../_util/response.js'
import { requireUser } from '../_util/auth.js'
import { computeBalanceCents } from '../_util/db.js'
import { randomToken, sha256Base64Url } from '../_util/crypto.js'

async function attachBalance(DB, rows) {
  const out = []
  for (const r of rows) {
    const bal = await computeBalanceCents(DB, r.id)
    out.push({
      ...r,
      id: Number(r.id),
      principal_cents: Number(r.principal_cents),
      balance_cents: Number(bal ?? 0),
    })
  }
  return out
}

export async function onRequestGet(context) {
  const { user, response } = await requireUser(context)
  if (response) return response

  const { DB } = context.env

  const ownedRes = await DB.prepare(`
    SELECT d.id, d.direction, d.title, d.counterparty_name, d.currency, d.principal_cents, d.due_date, d.status, d.created_at
    FROM debts d
    WHERE d.owner_user_id = ?
    ORDER BY d.created_at DESC
  `).bind(user.id).all()

  const sharedRes = await DB.prepare(`
    SELECT d.id, d.direction, d.title, d.counterparty_name, d.currency, d.principal_cents, d.due_date, d.status, d.created_at,
           ou.username AS owner_username
    FROM debts d
    JOIN debt_shares s ON s.debt_id = d.id
    JOIN users ou ON ou.id = d.owner_user_id
    WHERE s.counterparty_user_id = ?
    ORDER BY d.created_at DESC
  `).bind(user.id).all()

  return json({
    owned: await attachBalance(DB, ownedRes.results || []),
    shared: await attachBalance(DB, sharedRes.results || []),
  })
}

export async function onRequestPost(context) {
  const { user, response } = await requireUser(context)
  if (response) return response

  // Contraparte: solo confirmar pagos, no crear deudas
  if ((user.role || 'user') === 'counterparty') {
    return error(403, 'Tu cuenta es de contraparte: no puedes crear deudas.')
  }

  let body
  try { body = await context.request.json() } catch { return error(400, 'JSON inválido') }

  const title = String(body.title || '').trim()
  const counterparty_name = body.counterparty_name ? String(body.counterparty_name).trim() : null
  const counterparty_username = body.counterparty_username ? String(body.counterparty_username).trim().toLowerCase() : null
  const direction = body.direction === 'OWED_TO_ME' ? 'OWED_TO_ME' : 'I_OWE'
  const currency = body.currency ? String(body.currency).toUpperCase() : 'USD'
  const principal_cents = Number(body.principal_cents)
  const date = body.date ? String(body.date) : (body.due_date ? String(body.due_date) : null) // compat
  const notes = body.notes ? String(body.notes) : null

  const today = new Date().toISOString().slice(0,10)
  const debt_date = (date && /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(date)) ? date : today

  if (!title) return error(400, 'Título requerido')
  if (!Number.isFinite(principal_cents) || principal_cents <= 0) return error(400, 'Monto inválido')

  // Regla A: si la contraparte no existe, NO se crea deuda (para Yo debo)
  if (direction === 'I_OWE' && !counterparty_username) {
    return error(400, 'Debes indicar el usuario de la contraparte. Si no existe, pide al ADMIN que lo cree.')
  }

  const { DB } = context.env

  let counterparty_user = null
  if (counterparty_username) {
    const u = await DB.prepare(`
      SELECT id, username, role, is_active
      FROM users
      WHERE lower(username) = lower(?)
      LIMIT 1
    `).bind(counterparty_username).first()

    if (!u) return error(400, 'La contraparte no existe. Pide al ADMIN que cree ese usuario.')
    if (Number(u.is_active ?? 1) !== 1) return error(400, 'La contraparte está desactivada.')
    if ((u.role || 'user') === 'admin') return error(400, 'No puedes asignar ADMIN como contraparte.')

    counterparty_user = { id: Number(u.id), username: u.username, role: u.role || 'user' }
  }

  // 1) Crear deuda
  const res = await DB.prepare(`
    INSERT INTO debts (owner_user_id, direction, title, counterparty_name, currency, principal_cents, due_date, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(user.id, direction, title, counterparty_name, currency, principal_cents, debt_date, notes).run()

  const debt_id = Number(res.meta.last_row_id)

  // 2) Vincular contraparte si aplica (sin tokens)
  if (counterparty_user) {
    const can_confirm = direction === 'I_OWE' ? 1 : 0
    const dummy = await sha256Base64Url(randomToken(24))

    await DB.prepare(`
      INSERT INTO debt_shares (debt_id, owner_user_id, counterparty_user_id, invite_token_hash, invite_expires_at, can_confirm, accepted_at)
      VALUES (?, ?, ?, ?, NULL, ?, datetime('now'))
    `).bind(debt_id, user.id, counterparty_user.id, dummy, can_confirm).run()
  }

  return json({ ok: true, id: debt_id })
}
