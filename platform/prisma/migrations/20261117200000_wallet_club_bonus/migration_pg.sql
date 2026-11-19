ALTER TABLE miles_programs
    ADD COLUMN IF NOT EXISTS club_bonus_per_month BIGINT NOT NULL DEFAULT 0;
