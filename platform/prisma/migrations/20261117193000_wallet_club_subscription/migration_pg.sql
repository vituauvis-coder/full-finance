ALTER TABLE miles_programs
    ADD COLUMN IF NOT EXISTS club_started_on DATE,
    ADD COLUMN IF NOT EXISTS club_points_per_month BIGINT NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS miles_movements_club_month_uidx
    ON miles_movements (program_id, occurred_on)
    WHERE source = 'clube';
