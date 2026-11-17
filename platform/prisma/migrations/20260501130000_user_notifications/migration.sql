-- Avisos in-app (ex.: quem recebe o rateio fica sabendo quando o outro marca a parte como paga). Postgres (app local / Railway).
CREATE TABLE IF NOT EXISTS user_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    kind VARCHAR(64) NOT NULL,
    title TEXT NOT NULL,
    detail TEXT NOT NULL,
    read_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS user_notifications_user_created_idx ON user_notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS user_notifications_user_unread_idx ON user_notifications (user_id) WHERE read_at IS NULL;
