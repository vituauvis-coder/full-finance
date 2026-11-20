# Orçamento da viagem ↔ Dinheiro (cartão parcelado) — design

**Data:** 2026-11-19  
**Status:** Aprovado para implementação  
**Relacionado:** `motor/viagens/trip-expense-payment.js`, `motor/dinheiro/credit-installments.js`, Orçamento (ficha viagem), Saídas (Dinheiro)

## Problema

Na ficha **Orçamento da viagem**, o usuário junta dinheiro no **cofrinho** e lança gastos (Pix ou cartão). Hoje o gráfico **Comprometido** usa o **total gasto** (`spentTotal`), tratando compras no **cartão** como se já tivessem saído do cofrinho — mas no cartão o que se usa é o **limite/fatura**, com parcelas nos meses seguintes.

O app já tem, no módulo **Dinheiro**, motor de **parcelas + ciclo de fatura** (`credit-installments.js`, projeção em `projected-outflows.js`). Os gastos da viagem vivem só na **payload** do `trips` (`TripExpense`), **sem vínculo** com a tabela `expenses`.

## Objetivo

1. **Contabilizar o valor integral** do gasto na **categoria da viagem** e no **total da viagem** (Pix ou cartão).
2. **Não** incluir cartão na fatia **Comprometido** do cofrinho (só **Pix** = dinheiro já comprometido no sentido de caixa).
3. Para **cartão parcelado**, criar **um** lançamento no Dinheiro (Saídas) com cartão, data da compra e parcelas; o motor existente **projeta custo mensal** nas faturas **sem** duplicar 12 lançamentos manuais.
4. **Bidirecional:** lançar na viagem → espelha no Dinheiro; lançar em Saídas com viagem → espelha na ficha.
5. Categoria financeira visível (ex. **Viagens**), com subcategoria ou descrição ligada à viagem.

## Conceitos (três balanços)

| Conceito | Pix | Cartão (parcelado) |
|----------|-----|---------------------|
| **Gasto planejado da viagem** (teto/categoria) | valor integral | valor integral |
| **Comprometido do cofrinho** (donut meta) | valor integral | **0** |
| **Fluxo Dinheiro** | saída na data (como hoje) | **1 expense** + projeção mensal por parcela |

**Falta juntar** continua `meta − cofrinho` (aportes). Gasto no cartão **não** reduz o cofrinho até o pagamento da fatura (fase 2 opcional).

## Fonte da verdade

| Meio | Fonte canônica | Espelho |
|------|----------------|---------|
| **Cartão** | `expenses` (Dinheiro) | `TripExpense` na payload |
| **Pix (viagem)** | `TripExpense` | opcional espelho em `expenses` (fase 2) |

Regra: se `paymentMethod === 'credit_card'` e existe `accountId`, **obrigatório** `financeExpenseId` após sync.

## Modelo de dados

### `TripExpense` (payload — já existe, estender)

```ts
paymentMethod: 'pix' | 'credit_card'
installments: number
spentOn?: string              // data da compra (YYYY-MM-DD)
accountId?: string            // cartão em accounts
financeExpenseId?: string     // UUID em expenses
```

### `Expense` (Prisma / Dinheiro — novo)

```sql
ALTER TABLE expenses
  ADD COLUMN trip_id UUID REFERENCES trips(id) ON DELETE SET NULL,
  ADD COLUMN trip_expense_id VARCHAR(36);

CREATE INDEX expenses_trip_id_idx ON expenses(user_id, trip_id);
```

- `category`: valor fixo acordado no produto, ex. **`Viagens`** (deve existir em categorias de saída do usuário ou seed sugerido).
- `subcategory`: opcional = rótulo da categoria interna da viagem (`hospedagem`, etc.) ou nome da viagem.
- `description`: texto do lançamento na viagem.
- `installmentCount`: igual a `TripExpense.installments`.
- `date`: data da compra (`spentOn`).
- `isPaid`: cartão parcelado → `false` (padrão saída cartão); parcelas confirmadas via `cashOutConfirmedPeriods` como hoje.

### API viagem

- Sync ao salvar `TripExpense` cartão: criar/atualizar/deletar expense via endpoint existente de saídas, com `tripId` + `tripExpenseId` no body (estender `expensePayloadFromBody`).

## Regras de orçamento (motor)

Em `buildOrcamentoSnapshot` / UI:

- **spentTotal** / categorias: inalterado (soma de todos os `TripExpense.amount`).
- **Donut Comprometido:** `expensePay.pixPaid` em vez de `spentTotal`.
- **Indicador cartão:** exibir `expensePay.cardCommitted` e `expensePay.cardInstallmentMonthly` no panorama (fora do arco “comprometido do cofrinho”).

Ajustar testes em `trip-expense-payment.test.js` se renomearmos `committedAmount` para deixar claro que “committed” no breakdown **total** ≠ “comprometido cofrinho”. Documentar no motor:

- `tripCashCommitted` = `pixPaid`
- `tripCardOnInvoice` = `cardCommitted`

(Opcional refatoração de nomes em PR dedicado para não quebrar sem migração de API.)

## Fluxos

### Viagem → Dinheiro

1. Usuário marca **Cartão**, valor, parcelas, **data**, **cartão** (conta `cartao_credito`).
2. On save (debounce da ficha ou blur do lançamento):
   - POST/PATCH `/api/.../expenses` com vínculo `tripId`, `tripExpenseId`.
3. Projeção mensal: **nenhum código novo** — `sumOutflowsProjectedForCalendarMonth` já aloca parcelas.

### Dinheiro → Viagem

1. Em Saídas, categoria Viagens, cartão, parcelas, campo **Viagem** (select da lista `trips` ativos).
2. Ao salvar, serviço `syncTripExpenseFromFinance(expense)`:
   - upsert `TripExpense` na payload (`financeExpenseId`, categoria mapeada, `destinationId` se houver UI).
3. Se viagem não informada, comportamento atual (só Dinheiro).

### Exclusão

- Apagar `TripExpense` cartão com `financeExpenseId` → DELETE expense (com confirmação se parcelas pagas).
- Apagar expense com `trip_id` → remover ou marcar `TripExpense` na payload (preferir remover para paridade).

## UI

### Orçamento (viagem)

- `ExpenseRow`: cartão → seletor de **conta cartão** (reuso API Carteira) + data da compra (já existe `spentOn` ou adicionar).
- `OrcamentoGoalDonut`: fatia laranja = só Pix; legenda cartão abaixo.
- Manter chips Pix/Cartão.

### Dinheiro

- `ExpenseFormModal` (frente React): se categoria = Viagens, mostrar select **Viagem** + opcional subcategoria orçamento.
- Planejamento/Dashboard: parcelas entram como hoje (sem mudança visual obrigatória na fase 1).

## Fase 2 (fora do escopo imediato)

- Pix na viagem espelhado em Saídas (conta débito/PIX).
- Ao **pagar fatura** (confirmar período), refletir baixa no cofrinho ou só no Dinheiro.
- Sincronizar edits de valor/parcelas com recálculo de projeção (já suportado se atualizar o mesmo expense).

## Testes

- Motor: snapshot orçamento — donut usa `pixPaid`; categorias usam total.
- Motor: sync idempotente viagem ↔ expense (mock).
- `credit-installments`: regressão inalterada.
- E2E manual: 12× a partir de dezembro aparece 12 meses no Planejamento.

## Fora de escopo

- Debitar cofrinho Malote global automaticamente ao pagar fatura.
- Multi-moeda.
- Vários cartões por um único `TripExpense`.

## Critérios de aceite

1. Cartão 12× R$ 1.200 na viagem: categoria += 1.200; comprometido donut += 0; Saídas tem 1 linha 12×; Planejamento mostra ~100/mês nos meses de vencimento.
2. Pix R$ 500 na viagem: categoria += 500; comprometido donut += 500.
3. Lançamento em Saídas com viagem + cartão aparece na lista de lançamentos do Orçamento.
4. Alterar mensalidade do cartão na Carteira não quebra vínculo; datas de parcela seguem `closeDay`/`dueDay`.