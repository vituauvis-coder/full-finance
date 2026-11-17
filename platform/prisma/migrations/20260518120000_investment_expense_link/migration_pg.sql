-- Liga caixinhas a subcategorias e aplicações a despesas (pool + alocada).

ALTER TABLE investment_buckets
    ADD COLUMN IF NOT EXISTS subcategory_id UUID REFERENCES subcategories(id) ON DELETE SET NULL;

ALTER TABLE investment_applications
    ADD COLUMN IF NOT EXISTS source_expense_id UUID REFERENCES expenses(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS allocated_expense_id UUID REFERENCES expenses(id) ON DELETE SET NULL;

ALTER TABLE expenses
    ADD COLUMN IF NOT EXISTS allocation_parent_id UUID REFERENCES expenses(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS investment_buckets_subcategory_id_idx ON investment_buckets(subcategory_id);
CREATE INDEX IF NOT EXISTS investment_applications_allocated_expense_id_idx ON investment_applications(allocated_expense_id);
CREATE INDEX IF NOT EXISTS investment_applications_source_expense_id_idx ON investment_applications(source_expense_id);
CREATE INDEX IF NOT EXISTS expenses_allocation_parent_id_idx ON expenses(allocation_parent_id);
