# Motor dinheiro

Regras puras de finanças (sem UI nem SQL).

| Módulo | Origem legado |
|--------|----------------|
| `split-net.js` | `legacy-web/js/core/split-net.js` |
| `movement-date.js` | `utils.js` (datas) |
| `loan-expense.js` | `credit-installments.js` (`isLoanExpense`) |
| `dashboard-facets.js` | facetas do painel (entradas/saídas) |
| `dashboard-period.js` | soma em intervalo civil |
| `account-type.js` | PIX / cartão de crédito |
| `cash-out-periods.js` | confirmação de débito em período |
| `cash-heatmap.js` | agregação diária e detalhe do heatmap |
| `calendar-month.js` | meses civis e flag de projeção |
| `projected-gains.js` | entradas por mês-calendário |
| `projected-outflows.js` | saídas projetadas (parcelas) |
| `projected-balance.js` | saldo após período futuro |
| `chart-month-balance.js` | série «Saldo em conta» no gráfico anual |
| `credit-installments.js` | parcelas cartão/empréstimo |
| `finance-preferences.js` | confirmação manual de caixa |
| `expense-cash-out.js` | despesa conta no fluxo |
| `billing-cycle.js`, `format-currency.js` | suporte a parcelas/UI |

Próximos: orçamento zero; paridade fina com `reports.js` (synthetic split gains no gráfico).