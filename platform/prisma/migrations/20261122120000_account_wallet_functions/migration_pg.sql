ALTER TABLE accounts
    ADD COLUMN IF NOT EXISTS wallet_functions JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE accounts
    ADD COLUMN IF NOT EXISTS is_primary_cash BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_accounts_primary_cash ON accounts (household_id, is_primary_cash)
    WHERE is_primary_cash = true;