# Orçamento viagem ↔ Dinheiro (cartão) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ligar gastos de cartão da viagem ao módulo Dinheiro (parcelas/fatura), contando o total na viagem mas excluindo cartão do “Comprometido” do cofrinho.

**Architecture:** Cartão parcelado tem fonte canônica em `expenses`; `TripExpense` espelha com `financeExpenseId`. Orçamento usa `pixPaid` no donut. Sync bidirecional via serviço no back + hooks no autosave da ficha.

**Tech Stack:** PostgreSQL migration, `back/index.js` expense APIs, Prisma schema, `motor/viagens/trip-expense-payment.js`, `motor/dinheiro/credit-installments.js`, React (`TripOrcamentoPanel`, `ExpenseRow`, `ExpenseFormModal`).

## Global Constraints

- **Sem deploy** sem permissão explícita do usuário na conversa.
- Categoria financeira fixa: **`Viagens`** (string exata na API de despesas).
- Parcelas: reutilizar `installmentCount` + motor existente (não criar N rows).
- Commits só quando o usuário pedir.
- Testes motor em `platform/tests/motor/`.

---

## File map

| Área | Arquivos |
|------|----------|
| DB | `platform/prisma/schema.prisma`, nova migration `*_expense_trip_link/migration_pg.sql` |
| API | `back/index.js` (`expensePayloadFromBody`, GET expenses SELECT) |
| Sync | `back/trip-finance-sync.js` (novo), `back/trips-repository.js` |
| Motor viagem | `motor/viagens/trip-expense-payment.js`, `front/.../orcamento-model.ts` |
| UI viagem | `ExpenseRow.tsx`, `TripOrcamentoPanel.tsx`, `OrcamentoGoalDonut.tsx`, `OrcamentoOverview.tsx` |
| UI dinheiro | `ExpenseFormModal.tsx` ou equivalente em `front/src/frentes/dinheiro/` |
| API front | `front/src/frentes/viagens/types.ts`, possível `tripFinanceSync.ts` |
| Docs spec | `platform/docs/superpowers/specs/2026-11-19-orcamento-viagem-dinheiro-cartao-design.md` |

---

### Task 1: Schema e API — vínculo viagem na despesa

**Files:**
- Modify: `platform/prisma/schema.prisma` (Expense + optional Trip relation)
- Create: `platform/prisma/migrations/20261119190000_expense_trip_link/migration_pg.sql`
- Modify: `back/index.js` — SELECT listagens, INSERT/UPDATE payload
- Test: `platform/tests/back/expense-trip-link.test.js` (novo, ou teste de integração mínimo se padrão do repo for outro)

**Interfaces:**
- Produces: expense JSON com `tripId`, `tripExpenseId` opcionais.

- [ ] **Step 1:** Migration `trip_id UUID REFERENCES trips(id) ON DELETE SET NULL`, `trip_expense_id VARCHAR(36)`, índice `(user_id, trip_id)`.
- [ ] **Step 2:** Atualizar Prisma `Expense` model.
- [ ] **Step 3:** `expensePayloadFromBody` aceita e persiste campos; validar `trip_id` pertence ao usuário.
- [ ] **Step 4:** Rodar migration local; smoke POST expense com `tripId`.

---

### Task 2: Motor orçamento — comprometido só Pix

**Files:**
- Modify: `motor/viagens/trip-expense-payment.js` (comentários + export alias `tripCashCommitted` = pixPaid)
- Modify: `front/src/frentes/viagens/components/orcamento/orcamento-model.ts`
- Modify: `front/src/frentes/viagens/components/orcamento/OrcamentoOverview.tsx` — `spent={snap.expensePay.pixPaid}`
- Modify: `front/src/frentes/viagens/components/orcamento/OrcamentoGoalDonut.tsx` — label tooltip “Saído (Pix)” ou manter “Comprometido” com doc
- Test: `platform/tests/motor/viagens/trip-expense-payment.test.js` + teste snapshot mínimo em novo `orcamento-snapshot.test.js` se fizer sentido

**Interfaces:**
- Consumes: `paymentBreakdown` existente.
- Produces: UI donut usa `pixPaid`; categorias continuam `spentTotal`.

- [ ] **Step 1:** Teste: breakdown com 100 Pix + 1200 card → comprometido visual = 100, total categoria = 1300.
- [ ] **Step 2:** Alterar `OrcamentoOverview` prop `spent`.
- [ ] **Step 3:** Linha resumo cartão: `formatBRL(cardCommitted)` + `~${cardInstallmentMonthly}/mês` no panorama.

---

### Task 3: Serviço sync Viagem → Dinheiro

**Files:**
- Create: `back/trip-finance-sync.js`
- Modify: `back/trips-repository.js` ou rota PATCH trip para chamar sync após payload expenses
- Modify: `front/src/frentes/viagens/types.ts` — `financeExpenseId`, `accountId`

**Interfaces:**
- `syncFinanceExpenseForTripExpense(userId, tripId, tripExpense, accounts)` → `{ financeExpenseId }`
- Cria expense: `category: 'Viagens'`, `accountId`, `amount`, `date` from `spentOn`, `installmentCount`, `tripId`, `tripExpenseId`, `description`

- [ ] **Step 1:** Teste unitário mock DB: create + update installments altera 1 row.
- [ ] **Step 2:** Implementar create/update/delete.
- [ ] **Step 3:** Hook em save trip (ou endpoint dedicado `POST /api/trips/:id/sync-expenses` chamado pelo debounce).

---

### Task 4: UI viagem — cartão com conta e data

**Files:**
- Modify: `ExpenseRow.tsx` — select cartão (fetch accounts `cartao_credito`), `spentOn` date input
- Modify: `TripOrcamentoPanel.tsx` — após `setExpenses`, disparar sync (ou incluir no `saveTrip` pipeline)

- [ ] **Step 1:** Campos obrigatórios quando `credit_card`: conta + data + installments ≥ 1.
- [ ] **Step 2:** Persistir `accountId`, `spentOn`, `financeExpenseId` na payload após sync.
- [ ] **Step 3:** Erro amigável se cartão não configurado (link “Abrir Carteira”).

---

### Task 5: Dinheiro → Viagem (reverso)

**Files:**
- Modify: `ExpenseFormModal.tsx` (ou página Saídas React) — select viagem se categoria Viagens
- Modify: `back/trip-finance-sync.js` — `upsertTripExpenseFromFinance`

- [ ] **Step 1:** Ao POST/PATCH expense com `tripId`, upsert `TripExpense` na payload (match `tripExpenseId` ou `financeExpenseId`).
- [ ] **Step 2:** Mapear categoria viagem default `extras` ou subcategory string.
- [ ] **Step 3:** Teste: expense criado → GET trip contém lançamento espelho.

---

### Task 6: Categoria Viagens no Dinheiro

**Files:**
- Seed ou doc: garantir categoria **Viagens** em `expense-categories` (legacy) + hook `useCategories`
- Modify se necessário migration de categories table

- [ ] **Step 1:** Verificar se categoria já existe; se não, seed idempotente.
- [ ] **Step 2:** Filtro rápido em Saídas por viagem (opcional fase 1: só select no form).

---

### Task 7: Verificação manual e regressão

- [ ] Compra 12× na viagem → Planejamento mostra 12 meses; donut comprometido 0.
- [ ] Pix na viagem → donut incrementa.
- [ ] Deletar lançamento viagem remove expense.
- [ ] `node --test platform/tests/motor/viagens/trip-expense-payment.test.js`

---

## Ordem sugerida de PRs

1. **PR1:** Task 1 + Task 2 (schema + donut Pix) — entrega valor visual imediato.
2. **PR2:** Task 3 + Task 4 (viagem → Dinheiro).
3. **PR3:** Task 5 + Task 6 (reverso + categoria).

## Test plan (aceite)

- [ ] 12× R$ 1.200, compra dez/2025, cartão com vencimento dia 5: 12 parcelas projetadas; categoria viagem +1.200; comprometido +0.
- [ ] Pix R$ 500: comprometido +500, categoria +500.
- [ ] Saída Dinheiro com tripId: aparece no Orçamento da viagem.
- [ ] Dois candidatos de voo não afetam este escopo (já corrigido em `tripWalletPointsNeeded`).