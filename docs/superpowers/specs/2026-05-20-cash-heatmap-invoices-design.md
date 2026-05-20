# Heatmap de Caixa — faturas simplificadas (design)

**Data:** 2026-05-20  
**Status:** Aprovado (brainstorming)  
**Relacionado:** `docs/superpowers/specs/2026-05-20-cash-heatmap-design.md`

## Objetivo

Exibir vencimento de fatura de cartão no heatmap e em Detalhes do Dia de forma **simples**: dia de vencimento + valor, em amarelo — sem cálculo de ciclo, parcelas ou status de pagamento.

## Decisões do usuário

| Tópico | Escolha |
|--------|---------|
| Valor da fatura | Soma de todas as saídas do cartão no **mês exibido** |
| Visual sem movimentação | Célula inteira amarela/âmbar |
| Visual com movimentação | Cor do heatmap + indicador amarelo |
| Conferir se paga | Não |
| Cálculo robusto (`creditCardInvoiceTotalForCycle`) | Não usar no heatmap |

## Regras de dados

Por cartão de crédito com `dueDay` / `dueDate` válido:

1. **Dia no calendário:** dia civil = `dueDay` (limitado ao último dia do mês).
2. **Valor:** `Σ expense.amount` onde `expense.accountId === card.id` e `movementDateToJsDate(expense.date)` está no mesmo `(year, monthIndex)` do heatmap.
3. **Sempre listar** no vencimento, mesmo se valor = 0.
4. Vários cartões no mesmo dia → múltiplos itens no painel.

## Visual — calendário

| Condição | Aparência |
|----------|-----------|
| `temFatura` e sem entrada/saída no dia | Classe `cash-heatmap-day-btn--invoice-day` (fundo âmbar) |
| `temFatura` e com entrada e/ou saída | Classes do heatmap + `cash-heatmap-day-btn--invoice-marked` (borda/anel âmbar; ponto opcional) |
| Tooltip | Inclui linhas `Fatura {nome}: R$ {valor}` |

## Visual — Detalhes do Dia

- Item `kind: invoice`: título `Fatura — {nome}`, valor em tom âmbar, meta `Vencimento`.
- Ordenação: por valor decrescente junto com entradas/saídas.

## Legenda

Substituir rótulo «Pendência» por **«Vencimento fatura»** (swatch âmbar).

## Arquivos

| Arquivo | Mudança |
|---------|---------|
| `cash-heatmap-aggregations.js` | `sumCardExpensesInMonth`; remover `creditCardInvoiceTotalForCycle` |
| `cash-heatmap-calendar.js` | Prioridade visual; tooltip com faturas |
| `cash-heatmap-day-panel.js` | Tom âmbar consistente |
| `dashboard.css`, `theme-dark.css` | `--invoice-day`, `--invoice-marked` |

## Fora do escopo

- Ciclo de fechamento / vencimento real por `getBillingCycle`
- Ocultar fatura “já paga”
- Novo campo de valor no cadastro do cartão
