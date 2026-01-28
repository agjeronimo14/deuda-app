export async function getUserByEmail(DB, email) {
  try {
    return await DB.prepare('SELECT id, email, username, password_hash, role, is_active FROM users WHERE email = ?').bind(email).first()
  } catch {
    return await DB.prepare('SELECT id, email, username, password_hash FROM users WHERE email = ?').bind(email).first()
  }
}

export async function getUserByUsername(DB, username) {
  try {
    return await DB.prepare('SELECT id, email, username, password_hash, role, is_active FROM users WHERE username = ?').bind(username).first()
  } catch {
    return await DB.prepare('SELECT id, email, username, password_hash FROM users WHERE username = ?').bind(username).first()
  }
}

export async function computeBalanceCents(DB, debtId) {
  const row = await DB.prepare(`
    SELECT d.principal_cents - COALESCE((
      SELECT SUM(amount_cents) FROM payments
      WHERE debt_id = ? AND confirmation_status = 'CONFIRMED'
    ), 0) AS balance_cents
    FROM debts d
    WHERE d.id = ?
  `).bind(debtId, debtId).first()
  return row ? Number(row.balance_cents) : null
}

export async function updateDebtStatusIfPaid(DB, debtId) {
  const bal = await computeBalanceCents(DB, debtId)
  if (bal == null) return
  if (bal <= 0) {
    await DB.prepare(`UPDATE debts SET status='PAID', updated_at=datetime('now') WHERE id=? AND status!='PAID'`).bind(debtId).run()
  } else {
    await DB.prepare(`UPDATE debts SET status='OPEN', updated_at=datetime('now') WHERE id=? AND status='PAID'`).bind(debtId).run()
  }
}
