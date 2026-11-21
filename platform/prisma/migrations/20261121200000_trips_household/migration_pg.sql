-- trips.household_id: Meu Mundo sharing for Viagens module.
-- Creators without household_members are backfilled later via ensureHouseholdForUser
-- in the trips repository (Task 2).

ALTER TABLE trips
    ADD COLUMN IF NOT EXISTS household_id UUID REFERENCES households (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS trips_household_id_idx ON trips (household_id);

UPDATE trips t
SET household_id = hm.household_id
FROM household_members hm
WHERE hm.user_id = t.user_id
  AND t.household_id IS NULL;
