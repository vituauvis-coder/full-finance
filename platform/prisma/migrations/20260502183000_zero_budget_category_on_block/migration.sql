-- SQL Server: uma categoria por bloco; remove junção antiga.

IF COL_LENGTH('zero_budget_blocks', 'category_name') IS NULL
    ALTER TABLE zero_budget_blocks ADD category_name NVARCHAR(200) NULL;

UPDATE zb
SET category_name = COALESCE(
    (SELECT TOP 1 zbc.category_name
     FROM zero_budget_block_categories zbc
     WHERE zbc.block_id = zb.id
     ORDER BY zbc.category_name),
    zb.name
)
FROM zero_budget_blocks zb
WHERE zb.category_name IS NULL;

UPDATE zero_budget_blocks
SET category_name = name
WHERE category_name IS NULL OR LTRIM(RTRIM(category_name)) = N'';

ALTER TABLE zero_budget_blocks ALTER COLUMN category_name NVARCHAR(200) NOT NULL;

IF OBJECT_ID(N'dbo.zero_budget_block_categories', N'U') IS NOT NULL
    DROP TABLE dbo.zero_budget_block_categories;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'zero_budget_blocks_user_month_year_category_uq'
      AND object_id = OBJECT_ID(N'dbo.zero_budget_blocks')
)
    CREATE UNIQUE INDEX zero_budget_blocks_user_month_year_category_uq
        ON dbo.zero_budget_blocks (user_id, month, year, category_name);
