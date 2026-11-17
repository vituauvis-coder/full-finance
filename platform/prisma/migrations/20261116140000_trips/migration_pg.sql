-- Legado Meu Malote (schema antigo) → preservar se existir
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'trips'
          AND column_name = 'destination'
    ) THEN
        ALTER TABLE trips RENAME TO trips_legacy_simple;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS trips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'Nova viagem',
    starts_on DATE,
    ends_on DATE,
    status_override TEXT
        CHECK (status_override IS NULL OR status_override IN ('planejada', 'em_curso', 'realizada')),
    budget_caps JSONB NOT NULL DEFAULT '{}'::jsonb,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS trips_user_dates_idx ON trips (user_id, starts_on, ends_on);

COMMENT ON TABLE trips IS 'Viagens: ficha + destinos/gastos no JSON payload';