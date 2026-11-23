-- Integração agente externo (tokens + rastreabilidade de movimentos)

CREATE TABLE IF NOT EXISTS agent_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    token_hash TEXT NOT NULL,
    scopes TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS agent_tokens_token_hash_uq ON agent_tokens (token_hash);
CREATE INDEX IF NOT EXISTS agent_tokens_user_id_idx ON agent_tokens (user_id);

ALTER TABLE expenses
    ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'app',
    ADD COLUMN IF NOT EXISTS external_ref TEXT,
    ADD COLUMN IF NOT EXISTS receipt_url TEXT;

ALTER TABLE gains
    ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'app',
    ADD COLUMN IF NOT EXISTS external_ref TEXT,
    ADD COLUMN IF NOT EXISTS receipt_url TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS expenses_user_external_ref_uq
    ON expenses (user_id, external_ref)
    WHERE external_ref IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS gains_user_external_ref_uq
    ON gains (user_id, external_ref)
    WHERE external_ref IS NOT NULL;