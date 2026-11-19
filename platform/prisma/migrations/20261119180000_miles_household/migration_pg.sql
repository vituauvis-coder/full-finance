ALTER TABLE miles_programs
    ADD COLUMN IF NOT EXISTS household_id UUID REFERENCES households (id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS holder_user_id UUID REFERENCES users (id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS miles_programs_household_brand_uidx
    ON miles_programs (household_id, brand)
    WHERE household_id IS NOT NULL AND brand <> 'outro';

CREATE INDEX IF NOT EXISTS miles_programs_household_idx ON miles_programs (household_id);

DROP INDEX IF EXISTS miles_programs_user_brand_uidx;
CREATE UNIQUE INDEX IF NOT EXISTS miles_programs_user_brand_uidx
    ON miles_programs (user_id, brand)
    WHERE brand <> 'outro' AND household_id IS NULL;