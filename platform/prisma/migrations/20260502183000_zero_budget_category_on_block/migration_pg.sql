-- Planejamento Base Zero: uma categoria por bloco (coluna direta em zero_budget_blocks).
-- Remove a tabela de junção antiga, se existir.
-- Idempotente: pode correr várias vezes; seguro se zero_budget_block_categories nunca existiu.

ALTER TABLE zero_budget_blocks
    ADD COLUMN IF NOT EXISTS category_name VARCHAR(200);

DO $migration$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = current_schema()
          AND table_name = 'zero_budget_block_categories'
    ) THEN
        UPDATE zero_budget_blocks zb
        SET category_name = COALESCE(
            (SELECT zbc.category_name
             FROM zero_budget_block_categories zbc
             WHERE zbc.block_id = zb.id
             ORDER BY zbc.category_name
             LIMIT 1),
            zb.name
        )
        WHERE zb.category_name IS NULL;
    END IF;
END $migration$;

UPDATE zero_budget_blocks
SET category_name = name
WHERE category_name IS NULL OR TRIM(category_name) = '';

ALTER TABLE zero_budget_blocks
    ALTER COLUMN category_name SET NOT NULL;

DROP TABLE IF EXISTS zero_budget_block_categories;

CREATE UNIQUE INDEX IF NOT EXISTS zero_budget_blocks_user_month_year_category_uq
    ON zero_budget_blocks (user_id, month, year, category_name);
