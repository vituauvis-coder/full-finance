-- Rename investimentos → cofrinhos (tables, expense flag, category label)

-- Expense flag
ALTER TABLE expenses RENAME COLUMN is_investment TO is_cofrinho;

-- Cofrinho tables
ALTER TABLE investment_bucket_goals RENAME TO cofrinho_bucket_goals;
ALTER TABLE investment_applications RENAME TO cofrinho_applications;
ALTER TABLE investment_buckets RENAME TO cofrinho_buckets;

-- Indexes (rename if exist)
ALTER INDEX IF EXISTS investment_buckets_user_id_idx RENAME TO cofrinho_buckets_user_id_idx;
ALTER INDEX IF EXISTS investment_applications_user_id_idx RENAME TO cofrinho_applications_user_id_idx;
ALTER INDEX IF EXISTS investment_applications_ref_month_idx RENAME TO cofrinho_applications_ref_month_idx;
ALTER INDEX IF EXISTS investment_bucket_goals_user_year_idx RENAME TO cofrinho_bucket_goals_user_year_idx;
ALTER INDEX IF EXISTS investment_buckets_subcategory_id_idx RENAME TO cofrinho_buckets_subcategory_id_idx;
ALTER INDEX IF EXISTS investment_applications_allocated_expense_id_idx RENAME TO cofrinho_applications_allocated_expense_id_idx;
ALTER INDEX IF EXISTS investment_applications_source_expense_id_idx RENAME TO cofrinho_applications_source_expense_id_idx;

-- Category label (expenses + categories)
UPDATE categories SET name = 'Cofrinhos', updated_at = NOW()
 WHERE type = 'EXPENSE' AND LOWER(TRIM(name)) = 'investimentos';

UPDATE expenses SET category = 'Cofrinhos'
 WHERE LOWER(TRIM(category)) = 'investimentos';

-- Legacy objectives screen (Goal table)
DROP TABLE IF EXISTS goals;
