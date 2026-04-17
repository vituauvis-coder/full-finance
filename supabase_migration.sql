-- Supabase migration (PostgreSQL) for Full Finanças
-- Run in Supabase SQL Editor.

BEGIN;

-- UUID generator used by DEFAULT gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =========================
-- Core tables
-- =========================

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  name text NOT NULL,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  currency text NOT NULL DEFAULT 'BRL',
  has_completed_tour boolean NOT NULL DEFAULT false,
  profile_photo_url text,
  role text NOT NULL DEFAULT 'USER',
  finance_preferences text
);

CREATE TABLE IF NOT EXISTS accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  type text NOT NULL,
  initial_balance double precision NOT NULL DEFAULT 0,
  holder_name text,
  plastic_tone text,
  plastic_color text,
  "limit" double precision,
  close_day integer,
  due_day integer,
  linked_account_id uuid,
  CONSTRAINT accounts_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT accounts_linked_account_id_fkey FOREIGN KEY (linked_account_id) REFERENCES accounts(id) ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS accounts_user_id_idx ON accounts(user_id);
CREATE INDEX IF NOT EXISTS accounts_linked_account_id_idx ON accounts(linked_account_id);

CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  type text NOT NULL DEFAULT 'EXPENSE', -- EXPENSE | GAIN
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT categories_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE UNIQUE INDEX IF NOT EXISTS categories_user_id_name_key ON categories(user_id, name);
CREATE INDEX IF NOT EXISTS categories_user_id_idx ON categories(user_id);

CREATE TABLE IF NOT EXISTS subcategories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  category_id uuid NOT NULL,
  name text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT subcategories_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT subcategories_category_id_fkey FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE UNIQUE INDEX IF NOT EXISTS subcategories_user_cat_name_key ON subcategories(user_id, category_id, name);
CREATE INDEX IF NOT EXISTS subcategories_user_id_idx ON subcategories(user_id);
CREATE INDEX IF NOT EXISTS subcategories_category_id_idx ON subcategories(category_id);

-- =========================
-- Finance movements
-- =========================

CREATE TABLE IF NOT EXISTS expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  account_id uuid NOT NULL,
  category text NOT NULL,
  subcategory text,
  amount double precision NOT NULL,
  description text NOT NULL,
  date timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  is_paid boolean NOT NULL DEFAULT true,
  is_investment boolean NOT NULL DEFAULT false,
  installment_count integer,
  cash_out_confirmed_periods text,
  recurring_monthly boolean NOT NULL DEFAULT false,
  recurrence_group_id uuid,
  split_request_id uuid,
  CONSTRAINT expenses_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT expenses_account_id_fkey FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE UNIQUE INDEX IF NOT EXISTS expenses_split_request_id_key ON expenses(split_request_id);
CREATE INDEX IF NOT EXISTS expenses_user_recurrence_group_idx ON expenses(user_id, recurrence_group_id);
CREATE INDEX IF NOT EXISTS expenses_user_id_idx ON expenses(user_id);
CREATE INDEX IF NOT EXISTS expenses_account_id_idx ON expenses(account_id);
CREATE INDEX IF NOT EXISTS expenses_date_idx ON expenses(date);

CREATE TABLE IF NOT EXISTS gains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  account_id uuid NOT NULL,
  category text NOT NULL,
  subcategory text,
  amount double precision NOT NULL,
  description text NOT NULL,
  date timestamptz NOT NULL,
  is_paid boolean NOT NULL DEFAULT true,
  recurrence_group_id uuid,
  related_expense_id uuid,
  CONSTRAINT gains_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT gains_account_id_fkey FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS gains_user_recurrence_group_idx ON gains(user_id, recurrence_group_id);
CREATE INDEX IF NOT EXISTS gains_related_expense_id_idx ON gains(related_expense_id);
CREATE INDEX IF NOT EXISTS gains_user_id_idx ON gains(user_id);
CREATE INDEX IF NOT EXISTS gains_account_id_idx ON gains(account_id);
CREATE INDEX IF NOT EXISTS gains_date_idx ON gains(date);

-- =========================
-- Goals / Investments
-- =========================

CREATE TABLE IF NOT EXISTS goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  target_amount double precision NOT NULL,
  current_amount double precision NOT NULL DEFAULT 0,
  goal_type text NOT NULL DEFAULT 'outro',
  linked_account_ids text,
  CONSTRAINT goals_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS goals_user_id_idx ON goals(user_id);

CREATE TABLE IF NOT EXISTS investments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  category text NOT NULL,
  institution text,
  current_value double precision NOT NULL DEFAULT 0,
  notes text,
  linked_account_id uuid,
  CONSTRAINT investments_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT investments_linked_account_id_fkey FOREIGN KEY (linked_account_id) REFERENCES accounts(id) ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS investments_user_id_idx ON investments(user_id);
CREATE INDEX IF NOT EXISTS investments_linked_account_id_idx ON investments(linked_account_id);

-- =========================
-- Debts
-- =========================

CREATE TABLE IF NOT EXISTS debts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  company text NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  is_closed boolean NOT NULL DEFAULT false,
  CONSTRAINT debts_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS debts_user_closed_idx ON debts(user_id, is_closed);

CREATE TABLE IF NOT EXISTS debt_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  debt_id uuid NOT NULL,
  date timestamptz NOT NULL,
  amount double precision NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT debt_updates_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT debt_updates_debt_id_fkey FOREIGN KEY (debt_id) REFERENCES debts(id) ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS debt_updates_user_date_idx ON debt_updates(user_id, date);
CREATE INDEX IF NOT EXISTS debt_updates_debt_date_idx ON debt_updates(debt_id, date);

-- =========================
-- Balance snapshots
-- =========================

CREATE TABLE IF NOT EXISTS balance_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  date date NOT NULL,
  total_balance double precision NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT balance_snapshots_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE UNIQUE INDEX IF NOT EXISTS balance_snapshots_user_date_key ON balance_snapshots(user_id, date);
CREATE INDEX IF NOT EXISTS balance_snapshots_user_date_idx ON balance_snapshots(user_id, date);

-- =========================
-- Expense split requests
-- =========================

CREATE TABLE IF NOT EXISTS expense_split_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_expense_id uuid NOT NULL,
  requester_user_id uuid NOT NULL,
  recipient_user_id uuid NOT NULL,
  amount double precision NOT NULL,
  requester_credit_account_id uuid,
  status text NOT NULL DEFAULT 'PENDING', -- PENDING | ACCEPTED | REJECTED | CANCELLED
  sender_proof_url text,
  created_gain_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT expense_split_requests_source_expense_id_fkey FOREIGN KEY (source_expense_id) REFERENCES expenses(id) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT expense_split_requests_requester_user_id_fkey FOREIGN KEY (requester_user_id) REFERENCES users(id) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT expense_split_requests_recipient_user_id_fkey FOREIGN KEY (recipient_user_id) REFERENCES users(id) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT expense_split_requests_requester_credit_account_id_fkey FOREIGN KEY (requester_credit_account_id) REFERENCES accounts(id) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT expense_split_requests_created_gain_id_fkey FOREIGN KEY (created_gain_id) REFERENCES gains(id) ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS expense_split_requests_recipient_status_idx ON expense_split_requests(recipient_user_id, status);
CREATE INDEX IF NOT EXISTS expense_split_requests_requester_status_idx ON expense_split_requests(requester_user_id, status);
CREATE INDEX IF NOT EXISTS expense_split_requests_source_expense_idx ON expense_split_requests(source_expense_id);

-- Link back from expenses.split_request_id -> expense_split_requests.id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'expenses'
      AND c.conname = 'expenses_split_request_id_fkey'
  ) THEN
    ALTER TABLE expenses
      ADD CONSTRAINT expenses_split_request_id_fkey
      FOREIGN KEY (split_request_id) REFERENCES expense_split_requests(id) ON DELETE NO ACTION ON UPDATE NO ACTION;
  END IF;
END $$;

-- =========================
-- Admin logs / feedbacks
-- =========================

CREATE TABLE IF NOT EXISTS admin_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  action text NOT NULL,
  details text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT admin_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS admin_logs_created_at_idx ON admin_logs(created_at);
CREATE INDEX IF NOT EXISTS admin_logs_action_idx ON admin_logs(action);

CREATE TABLE IF NOT EXISTS feedbacks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT feedbacks_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS feedbacks_created_at_idx ON feedbacks(created_at);

-- =========================
-- Kanban cards
-- =========================

CREATE TABLE IF NOT EXISTS kanban_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  type text NOT NULL DEFAULT 'melhoria', -- bug | melhoria
  "column" text NOT NULL DEFAULT 'backlog', -- backlog | ativo | teste | finalizado
  description text,
  image text,
  screen text,
  steps text,
  expected text,
  actual text,
  benefit text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT kanban_cards_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS kanban_cards_column_idx ON kanban_cards("column");
CREATE INDEX IF NOT EXISTS kanban_cards_type_idx ON kanban_cards(type);
CREATE INDEX IF NOT EXISTS kanban_cards_created_at_idx ON kanban_cards(created_at);

COMMIT;
