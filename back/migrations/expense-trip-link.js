import { query } from '../db.js';

let expenseTripLinkReady = false;

/**
 * Garante colunas de vínculo viagem ↔ expenses (sync orçamento → Dinheiro).
 * Idempotente; falha de startup bloqueia se não puder aplicar.
 */
export async function ensureExpenseTripLinkColumns() {
    if (expenseTripLinkReady) return;
    await query(`
        ALTER TABLE expenses
            ADD COLUMN IF NOT EXISTS trip_id UUID REFERENCES trips (id) ON DELETE SET NULL
    `);
    await query(`
        ALTER TABLE expenses
            ADD COLUMN IF NOT EXISTS trip_expense_id VARCHAR(36)
    `);
    await query(`
        CREATE INDEX IF NOT EXISTS expenses_user_trip_id_idx ON expenses (user_id, trip_id)
    `);
    expenseTripLinkReady = true;
}