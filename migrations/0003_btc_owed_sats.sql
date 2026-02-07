-- BTC owed tracking (satoshis) + manual/auto mode for "Me deben" without breaking existing schema.
-- Apply: npx wrangler d1 migrations apply <DB_NAME> --remote

ALTER TABLE debts ADD COLUMN amount_mode TEXT DEFAULT 'manual_usd'; -- manual_usd | btc_anchored_usd
ALTER TABLE debts ADD COLUMN base_currency TEXT DEFAULT 'USD';
ALTER TABLE debts ADD COLUMN btc_sent_sats INTEGER;                -- satoshis sent when creating debt
ALTER TABLE debts ADD COLUMN btc_rate_usd_at_send REAL;            -- BTC spot USD at send time
ALTER TABLE debts ADD COLUMN btc_rate_eur_at_send REAL;            -- BTC spot EUR at send time

ALTER TABLE payments ADD COLUMN btc_paid_sats INTEGER;             -- satoshis received/returned for this payment
ALTER TABLE payments ADD COLUMN btc_rate_usd_at_payment REAL;
ALTER TABLE payments ADD COLUMN btc_rate_eur_at_payment REAL;

-- Backfill defaults for old rows
UPDATE debts SET amount_mode='manual_usd' WHERE amount_mode IS NULL;
UPDATE debts SET base_currency='USD' WHERE base_currency IS NULL;
