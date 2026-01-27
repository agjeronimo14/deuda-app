export async function getUserByEmail(DB, email) {
  return await DB.prepare('SELECT id, email, username, password_hash FROM users WHERE email = ?').bind(email).first()
}

export async function computeBalanceCents(DB, debtId) {
  const row = await DB.prepare(`
    SELECT d.principal_cents - COALESCE((
      SELECT SUM(amount_cents) FROM payments
      WHERE debt_id = ? AND confirmation_status != 'REJECTED'
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
