-- Force miles programs onto household (Meu Mundo). Unique (household_id, brand)
-- conflicts must be resolved via merge / 409 (Task 10).

UPDATE miles_programs p
SET household_id = hm.household_id,
    holder_user_id = COALESCE(p.holder_user_id, p.user_id)
FROM household_members hm
WHERE hm.user_id = p.user_id
  AND p.household_id IS NULL;
