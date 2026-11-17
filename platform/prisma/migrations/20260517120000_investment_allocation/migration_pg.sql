-- Investimentos: caixinhas configuráveis, aplicações (aportes) e metas anuais.
-- Remove carteira legada (posições em ativos).

DROP TABLE IF EXISTS investments;

CREATE TABLE IF NOT EXISTS investment_buckets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    color_key VARCHAR(50) NOT NULL DEFAULT 'violet',
    icon VARCHAR(80) NOT NULL DEFAULT 'fa-chart-line',
    sort_order INT NOT NULL DEFAULT 0,
    yield_multiplier DOUBLE PRECISION NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS investment_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    bucket_id UUID NOT NULL REFERENCES investment_buckets(id) ON DELETE RESTRICT,
    reference_month DATE NOT NULL,
    amount DOUBLE PRECISION NOT NULL,
    account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'Concluído',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS investment_bucket_goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    bucket_id UUID NOT NULL REFERENCES investment_buckets(id) ON DELETE CASCADE,
    year INT NOT NULL,
    target_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
    achieved_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
    status VARCHAR(50) NOT NULL DEFAULT 'Em andamento',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, bucket_id, year)
);

CREATE INDEX IF NOT EXISTS investment_buckets_user_id_idx ON investment_buckets(user_id);
CREATE INDEX IF NOT EXISTS investment_applications_user_id_idx ON investment_applications(user_id);
CREATE INDEX IF NOT EXISTS investment_applications_ref_month_idx ON investment_applications(user_id, reference_month);
CREATE INDEX IF NOT EXISTS investment_bucket_goals_user_year_idx ON investment_bucket_goals(user_id, year);
