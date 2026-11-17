/*
  Despesas de um mês calendário (PostgreSQL) + soma.
  Tabelas: public.expenses / public.accounts

  Critério: data do LANÇAMENTO (expenses.date) dentro do intervalo do mês.
  Comparação por date::date para evitar problema de hora.

  Observação: no app web, cartão de crédito usa parcelas por vencimento (JS).
  Esta query só filtra pela coluna expenses.date do lançamento.
*/

-- Ajuste aqui
-- (No Supabase SQL editor você pode trocar pelos valores desejados.)
DO $$
DECLARE
  user_id uuid := 'COLOQUE-SEU-USER-ID-AQUI';
  yy int := 2026;
  mm int := 4; -- 1 = janeiro, 12 = dezembro
  start_date date := make_date(yy, mm, 1);
  end_date date := (make_date(yy, mm, 1) + interval '1 month')::date; -- exclusivo
BEGIN

  -- ========== 1) Detalhe do mês ==========
  RAISE NOTICE 'Detalhe % a %', start_date, (end_date - 1);
  PERFORM 1;
END $$;

SELECT
  e.id,
  e.user_id       AS "userId",
  e.account_id    AS "accountId",
  e.category,
  e.subcategory,
  e.amount,
  e.description,
  e.date,
  e.is_paid       AS "isPaid",
  e.is_investment AS "isInvestment",
  e.installment_count AS "installmentCount",
  a.name          AS "accountName",
  a.type          AS "accountType"
FROM expenses e
JOIN accounts a ON a.id = e.account_id
WHERE e.user_id = 'COLOQUE-SEU-USER-ID-AQUI'::uuid
  AND (e.date::date) >= make_date(2026, 4, 1)
  AND (e.date::date) <  (make_date(2026, 4, 1) + interval '1 month')::date
ORDER BY e.date DESC, e.description;

-- ========== 2) Soma do mês (SUM sem linhas → 0, não NULL) ==========
SELECT
  make_date(2026, 4, 1) AS "monthStart",
  ((make_date(2026, 4, 1) + interval '1 month')::date - 1) AS "monthEnd",
  COUNT(*)::int AS "expenseCount",
  COALESCE(SUM(e.amount), 0) AS "totalAmount"
FROM expenses e
WHERE e.user_id = 'COLOQUE-SEU-USER-ID-AQUI'::uuid
  AND (e.date::date) >= make_date(2026, 4, 1)
  AND (e.date::date) <  (make_date(2026, 4, 1) + interval '1 month')::date;
