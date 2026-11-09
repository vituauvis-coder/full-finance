-- Casa compartilhada + titular vinculado a usuário (PostgreSQL)

CREATE TABLE IF NOT EXISTS households (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL DEFAULT 'Minha casa',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS household_members (
    household_id UUID NOT NULL REFERENCES households (id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member',
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (household_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_household_members_user_id ON household_members (user_id);

ALTER TABLE accounts ADD COLUMN IF NOT EXISTS household_id UUID REFERENCES households (id);
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS holder_user_id UUID REFERENCES users (id);

CREATE INDEX IF NOT EXISTS idx_accounts_household_id ON accounts (household_id);
CREATE INDEX IF NOT EXISTS idx_accounts_holder_user_id ON accounts (holder_user_id);
