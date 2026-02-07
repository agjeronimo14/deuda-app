-- EUR equivalents + movement types (PAYMENT reduces, CHARGE increases)
-- Non-breaking: existing rows default to PAYMENT.

ALTER TABLE debts ADD COLUMN principal_eur_cents INTEGER; -- optional info for BTC/manual cases

ALTER TABLE payments ADD COLUMN kind TEXT DEFAULT 'PAYMENT'; -- PAYMENT | CHARGE
ALTER TABLE payments ADD COLUMN eur_equiv_cents INTEGER;     -- optional info

-- Backfill existing rows
UPDATE payments SET kind='PAYMENT' WHERE kind IS NULL;
