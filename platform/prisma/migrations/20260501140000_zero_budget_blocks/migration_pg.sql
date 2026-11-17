-- Migration: Tabelas para Planejamento Base Zero (Zero-Based Budgeting)
-- Versão PostgreSQL (Supabase/Railway)
-- Cria blocos de orçamento vinculados a categorias de despesas

-- Tabela principal de blocos de orçamento
CREATE TABLE IF NOT EXISTS zero_budget_blocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    color VARCHAR(50) NOT NULL DEFAULT 'bg-teal-500',
    allocated_amount FLOAT NOT NULL DEFAULT 0,
    month INT NOT NULL,
    year INT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabela de vinculo entre blocos e categorias (many-to-many)
CREATE TABLE IF NOT EXISTS zero_budget_block_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    block_id UUID NOT NULL REFERENCES zero_budget_blocks(id) ON DELETE CASCADE,
    category_name VARCHAR(200) NOT NULL,
    UNIQUE(block_id, category_name)
);

-- Indices para performance
CREATE INDEX IF NOT EXISTS zero_budget_blocks_user_id_idx ON zero_budget_blocks(user_id);
CREATE INDEX IF NOT EXISTS zero_budget_blocks_month_year_idx ON zero_budget_blocks(month, year);
CREATE INDEX IF NOT EXISTS zero_budget_blocks_user_month_year_idx ON zero_budget_blocks(user_id, month, year);
CREATE INDEX IF NOT EXISTS zero_budget_block_categories_block_id_idx ON zero_budget_block_categories(block_id);
