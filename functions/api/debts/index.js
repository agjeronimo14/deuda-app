import { json, error } from '../_util/response.js'
import { requireUser, requireAdmin } from '../_util/auth.js'
import { computeBalanceCents } from '../_util/db.js'
import { hashPassword, randomToken, sha256Base64Url } from '../_util/crypto.js'

function slugify(s) {
  s = String(s || '').toLowerCase().trim()
  s = s.replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
  return s || 'contraparte'
}

function randomPassword(len=10){
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  let out = ''
  for (let i=0;i<len;i++) out += chars[Math.floor(Math.random()*chars.length)]
  return out
}

async function uniqueUsername(DB, base) {
  for (let i=0;i<30;i++) {
    const suffix = Math.floor(1000 + Math.random()*9000)
    const username = `${base}-${suffix}`
    const exists = await DB.prepare('SELECT id FROM users WHERE username=?').bind(username).first()
    if (!exists) return username
  }
  // fallback
  return `${base}-${Date.now()}`
}

export async function onRequestGet(context) {
  const { user, response } = await requireUser(context)
  if (response) return response

  const { DB } = context.env

  const ownedRes = await DB.prepare(`
    SELECT id, direction, title, counterparty_name, currency, principal_cents, due_date, status, created_at
    FROM debts
    WHERE owner_user_id = ?
    ORDER BY created_at DESC
  `).bind(user.id).all()

  const sharedRes = await DB.prepare(`
    SELECT d.id, d.direction, d.title, d.counterparty_name, d.currency, d.principal_cents, d.due_date, d.status, d.created_at
    FROM debts d
    JOIN debt_shares s ON s.debt_id = d.id
    WHERE s.counterparty_user_id = ?
    ORDER BY d.created_at DESC
  `).bind(user.id).all()

  async function attachBalance(rows) {
    const out = []
    for (const r of rows) {
      const bal = await computeBalanceCents(DB, r.id)
      out.push({ ...r, principal_cents: Number(r.principal_cents), balance_cents: Number(bal ?? 0) })
    }
    return out
  }

  return json({
    owned: await attachBalance(ownedRes.results || []),
    shared: await attachBalance(sharedRes.results || []),
  })
}

export async function onRequestPost(context) {
  // Solo ADMIN crea deudas (porque también crea usuarios de contraparte)
  const { user, response } = await requireAdmin(context)
  if (response) return response

  let body
  try { body = await context.request.json() } catch { return error(400, 'JSON inválido') }

  const title = String(body.title || '').trim()
  const counterparty_name = body.counterparty_name ? String(body.counterparty_name).trim() : null
  const direction = body.direction === 'OWED_TO_ME' ? 'OWED_TO_ME' : 'I_OWE'
  const currency = body.currency ? String(body.currency).toUpperCase() : 'USD'
  const principal_cents = Number(body.principal_cents)
  const date = body.date ? String(body.date) : (body.due_date ? String(body.due_date) : null) // compat
  const notes = body.notes ? String(body.notes) : null

  const today = new Date().toISOString().slice(0,10)
  const debt_date = (date && /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(date)) ? date : today

  if (!title) return error(400, 'Título requerido')
  if (!Number.isFinite(principal_cents) || principal_cents <= 0) return error(400, 'Monto inválido')

  const { DB } = context.env

  // 1) Crea la deuda
  const res = await DB.prepare(`
    INSERT INTO debts (owner_user_id, direction, title, counterparty_name, currency, principal_cents, due_date, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(user.id, direction, title, counterparty_name, currency, principal_cents, debt_date, notes).run()

  const debt_id = Number(res.meta.last_row_id)

  // 2) Si hay contraparte, crea usuario + share aceptado (sin tokens)
  let counterparty = null
  if (counterparty_name && counterparty_name.trim().length > 0) {
    const base = slugify(counterparty_name)
    const username = await uniqueUsername(DB, base)
    const temp_password = randomPassword(10)
    const email = `${username}@local`
    const password_hash = await hashPassword(temp_password)

    const uRes = await DB.prepare(`
      INSERT INTO users (email, username, password_hash, role, is_active)
      VALUES (?, ?, ?, 'counterparty', 1)
    `).bind(email, username, password_hash).run()

    const counterparty_user_id = Number(uRes.meta.last_row_id)

    // invite_token_hash es NOT NULL por esquema: guardamos un hash dummy (no se usa)
    const dummy = await sha256Base64Url(randomToken(24))

    await DB.prepare(`
      INSERT INTO debt_shares (debt_id, owner_user_id, counterparty_user_id, invite_token_hash, invite_expires_at, can_confirm, accepted_at)
      VALUES (?, ?, ?, ?, NULL, 1, datetime('now'))
    `).bind(debt_id, user.id, counterparty_user_id, dummy).run()

    counterparty = { username, temp_password }
  }

  return json({ ok: true, id: debt_id, counterparty })
}
