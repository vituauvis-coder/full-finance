import { query } from '../db.js';

let ready = false;

export async function ensureAgentIntegration() {
    if (ready) return;

    await query(`
        CREATE TABLE IF NOT EXISTS agent_tokens (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            token_hash TEXT NOT NULL,
            scopes TEXT[] NOT NULL DEFAULT '{}',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            last_used_at TIMESTAMPTZ,
            revoked_at TIMESTAMPTZ
        )
    `);
    await query(
        `CREATE UNIQUE INDEX IF NOT EXISTS agent_tokens_token_hash_uq ON agent_tokens (token_hash)`
    );
    await query(`CREATE INDEX IF NOT EXISTS agent_tokens_user_id_idx ON agent_tokens (user_id)`);

    await query(`
        ALTER TABLE expenses
            ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'app',
            ADD COLUMN IF NOT EXISTS external_ref TEXT,
            ADD COLUMN IF NOT EXISTS receipt_url TEXT
    `);
    await query(`
        ALTER TABLE gains
            ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'app',
            ADD COLUMN IF NOT EXISTS external_ref TEXT,
            ADD COLUMN IF NOT EXISTS receipt_url TEXT
    `);
    await query(`
        CREATE UNIQUE INDEX IF NOT EXISTS expenses_user_external_ref_uq
            ON expenses (user_id, external_ref)
            WHERE external_ref IS NOT NULL
    `);
    await query(`
        CREATE UNIQUE INDEX IF NOT EXISTS gains_user_external_ref_uq
            ON gains (user_id, external_ref)
            WHERE external_ref IS NOT NULL
    `);

    ready = true;
}