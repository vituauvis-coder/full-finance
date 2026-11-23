import { query } from '../db.js';

let ready = false;

/** Reconciliação mensal: principal vs saldo com rendimento por caixinha. */
export async function ensureCofrinhoMonthlyBalancesTable() {
    if (ready) return;

    await query(`
        CREATE TABLE IF NOT EXISTS cofrinho_monthly_balances (
            id UUID PRIMARY KEY,
            user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
            bucket_id UUID NOT NULL REFERENCES cofrinho_buckets (id) ON DELETE CASCADE,
            reference_month DATE NOT NULL,
            principal_amount DOUBLE PRECISION NOT NULL,
            balance_with_yield DOUBLE PRECISION NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CONSTRAINT cofrinho_monthly_balances_principal_nonneg CHECK (principal_amount >= 0),
            CONSTRAINT cofrinho_monthly_balances_balance_nonneg CHECK (balance_with_yield >= 0)
        )
    `);
    await query(`
        CREATE INDEX IF NOT EXISTS cofrinho_monthly_balances_user_idx
            ON cofrinho_monthly_balances (user_id)
    `);

    await query(`
        ALTER TABLE cofrinho_monthly_balances
            ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES accounts (id) ON DELETE SET NULL
    `);
    await query(`DROP INDEX IF EXISTS cofrinho_monthly_balances_bucket_month_uq`);
    await query(`
        CREATE UNIQUE INDEX IF NOT EXISTS cofrinho_monthly_balances_bucket_month_account_uq
            ON cofrinho_monthly_balances (
                user_id,
                bucket_id,
                reference_month,
                COALESCE(account_id, '00000000-0000-0000-0000-000000000000'::uuid)
            )
    `);

    ready = true;
}