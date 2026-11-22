import { query } from '../db.js';

let cofrinhoViagemLedgerReady = false;

/** Colunas `kind`, `trip_id` em buckets e `paid_from_cofrinho` em expenses (spec 2026-11-22). */
export async function ensureCofrinhoViagemLedgerColumns() {
    if (cofrinhoViagemLedgerReady) return;

    await query(`
        ALTER TABLE cofrinho_buckets
            ADD COLUMN IF NOT EXISTS kind VARCHAR(20) NOT NULL DEFAULT 'reserve'
    `);
    await query(`
        ALTER TABLE cofrinho_buckets
            ADD COLUMN IF NOT EXISTS trip_id UUID REFERENCES trips (id) ON DELETE SET NULL
    `);
    await query(`
        CREATE UNIQUE INDEX IF NOT EXISTS cofrinho_buckets_user_trip_uq
            ON cofrinho_buckets (user_id, trip_id)
            WHERE trip_id IS NOT NULL
    `);
    await query(`
        CREATE INDEX IF NOT EXISTS cofrinho_buckets_user_kind_idx
            ON cofrinho_buckets (user_id, kind)
    `);
    await query(`
        ALTER TABLE expenses
            ADD COLUMN IF NOT EXISTS paid_from_cofrinho BOOLEAN NOT NULL DEFAULT false
    `);
    await query(`
        CREATE INDEX IF NOT EXISTS expenses_user_trip_cofrinho_idx
            ON expenses (user_id, trip_id)
            WHERE is_cofrinho = true OR paid_from_cofrinho = true
    `);

    cofrinhoViagemLedgerReady = true;
}