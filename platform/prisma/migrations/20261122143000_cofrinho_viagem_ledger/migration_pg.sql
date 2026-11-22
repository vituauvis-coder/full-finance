-- Cofrinho ↔ Viagem ledger (spec 2026-11-22)

ALTER TABLE cofrinho_buckets
    ADD COLUMN IF NOT EXISTS kind VARCHAR(20) NOT NULL DEFAULT 'reserve';

ALTER TABLE cofrinho_buckets
    ADD COLUMN IF NOT EXISTS trip_id UUID REFERENCES trips (id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS cofrinho_buckets_user_trip_uq
    ON cofrinho_buckets (user_id, trip_id)
    WHERE trip_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS cofrinho_buckets_user_kind_idx
    ON cofrinho_buckets (user_id, kind);

ALTER TABLE expenses
    ADD COLUMN IF NOT EXISTS paid_from_cofrinho BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS expenses_user_trip_cofrinho_idx
    ON expenses (user_id, trip_id)
    WHERE is_cofrinho = true OR paid_from_cofrinho = true;

-- Aspiração legado → reserva genérica (caixinhas viagem passam a ter trip_id)
UPDATE cofrinho_buckets
SET kind = 'reserve'
WHERE trip_id IS NULL
  AND kind = 'reserve'
  AND lower(trim(name)) IN ('aspiração', 'aspiracao');