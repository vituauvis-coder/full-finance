-- Vínculo saída financeira ↔ lançamento na ficha da viagem.

ALTER TABLE expenses
    ADD COLUMN IF NOT EXISTS trip_id UUID REFERENCES trips (id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS trip_expense_id VARCHAR(36);

CREATE INDEX IF NOT EXISTS expenses_user_trip_id_idx ON expenses (user_id, trip_id);