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
  // balance = principal + confirmed_charges - confirmed_payments
  try {
    const row = await DB.prepare(`
      SELECT
        d.principal_cents
        + COALESCE((
          SELECT SUM(amount_cents) FROM payments
          WHERE debt_id = ? AND confirmation_status='CONFIRMED' AND COALESCE(kind,'PAYMENT')='CHARGE'
        ), 0)
        - COALESCE((
          SELECT SUM(amount_cents) FROM payments
          WHERE debt_id = ? AND confirmation_status='CONFIRMED' AND COALESCE(kind,'PAYMENT')='PAYMENT'
        ), 0) AS balance_cents
      FROM debts d
      WHERE d.id = ?
    `).bind(debtId, debtId, debtId).first()
    return row ? Number(row.balance_cents) : null
  } catch (e) {
    const msg = String(e?.message || e || '')
    // If migrations not applied yet, assume legacy behavior: all rows are PAYMENTS (no CHARGE).
    if (msg.includes('no such column: kind') || msg.includes('no such column: principal_eur_cents')) {
      const row = await DB.prepare(`
        SELECT d.principal_cents - COALESCE((
          SELECT SUM(amount_cents) FROM payments
          WHERE debt_id = ? AND confirmation_status='CONFIRMED'
        ), 0) AS balance_cents
        FROM debts d WHERE d.id = ?
      `).bind(debtId, debtId).first()
      return row ? Number(row.balance_cents) : null
    }
    throw e
  }
}


export async function computeBalanceEurCents(DB, debtId) {
  // balance_eur = principal_eur + confirmed_charges_eur - confirmed_payments_eur
  try {
    const row = await DB.prepare(`
      SELECT
        CASE
          WHEN d.principal_eur_cents IS NULL
            AND COALESCE((
              SELECT COUNT(1) FROM payments
              WHERE debt_id = ?
                AND confirmation_status='CONFIRMED'
                AND eur_equiv_cents IS NOT NULL
            ), 0) = 0
          THEN NULL
          ELSE COALESCE(d.principal_eur_cents, 0)
            + COALESCE((
              SELECT SUM(eur_equiv_cents) FROM payments
              WHERE debt_id = ?
                AND confirmation_status='CONFIRMED'
                AND eur_equiv_cents IS NOT NULL
                AND COALESCE(kind,'PAYMENT')='CHARGE'
            ), 0)
            - COALESCE((
              SELECT SUM(eur_equiv_cents) FROM payments
              WHERE debt_id = ?
                AND confirmation_status='CONFIRMED'
                AND eur_equiv_cents IS NOT NULL
                AND COALESCE(kind,'PAYMENT')='PAYMENT'
            ), 0)
        END AS balance_eur_cents
      FROM debts d
      WHERE d.id = ?
    `).bind(debtId, debtId, debtId, debtId).first()
    return row ? (row.balance_eur_cents == null ? null : Number(row.balance_eur_cents)) : null
  } catch (e) {
    const msg = String(e?.message || e || '')
    // Legacy DBs won't have these columns
    if (
      msg.includes('no such column: principal_eur_cents') ||
      msg.includes('no such column: eur_equiv_cents') ||
      msg.includes('no such column: kind')
    ) {
      return null
    }
    throw e
  }
}

export async function computeBalanceBtcSats(DB, debtId) {
  // balance_btc = btc_initial + confirmed_charges_btc - confirmed_payments_btc
  try {
    const row = await DB.prepare(`
      SELECT
        CASE
          WHEN d.btc_sent_sats IS NULL
            AND COALESCE((
              SELECT COUNT(1) FROM payments
              WHERE debt_id = ?
                AND confirmation_status='CONFIRMED'
                AND btc_paid_sats IS NOT NULL
            ), 0) = 0
          THEN NULL
          ELSE COALESCE(d.btc_sent_sats, 0)
            + COALESCE((
              SELECT SUM(btc_paid_sats) FROM payments
              WHERE debt_id = ?
                AND confirmation_status='CONFIRMED'
                AND btc_paid_sats IS NOT NULL
                AND COALESCE(kind,'PAYMENT')='CHARGE'
            ), 0)
            - COALESCE((
              SELECT SUM(btc_paid_sats) FROM payments
              WHERE debt_id = ?
                AND confirmation_status='CONFIRMED'
                AND btc_paid_sats IS NOT NULL
                AND COALESCE(kind,'PAYMENT')='PAYMENT'
            ), 0)
        END AS balance_btc_sats
      FROM debts d
      WHERE d.id = ?
    `).bind(debtId, debtId, debtId, debtId).first()
    return row ? (row.balance_btc_sats == null ? null : Number(row.balance_btc_sats)) : null
  } catch (e) {
    const msg = String(e?.message || e || '')
    if (
      msg.includes('no such column: btc_sent_sats') ||
      msg.includes('no such column: btc_paid_sats') ||
      msg.includes('no such column: kind')
    ) {
      return null
    }
    throw e
  }
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
