# Dashboard — inventário e arquitetura

Rota: `/dashboard` · Página: `frentes/dashboard/pages/DashboardPage.tsx`

## Blocos na tela (ordem)

| Bloco | Componente | Camada |
|-------|------------|--------|
| Header (facetas, filtro) | `components/header/DashboardHeaderActions.tsx` | UI |
| Timeline mês/ano | `components/finance/CivilPeriodToolbar.tsx` → `CivilPeriodTimeline.tsx` | UI |
| KPIs | `components/finance/DashboardSummaryCards.tsx` | UI |
| Confirmar no saldo | `components/DashboardMonthLedger.tsx` + `LedgerExtratoRow.tsx` | check no extrato |
| Fluxo financeiro | `components/FinancialFluxChart.tsx` + `components/flux/*` | UI + `hooks/` |
| Heatmap de caixa | `components/CashHeatmap.tsx` + calendário/painel | UI |
| Drawer categoria | `components/finance/DashboardCategoryDrawer.tsx` | UI |

## Estado e domínio

| Módulo | Caminho |
|--------|---------|
| Facetas (chips) | `context/DashboardFacetsContext.tsx` |
| Persistência facets | `domain/dashboardFacetStorage.ts` |
| KPIs + MoM | `domain/dashboardMetrics.ts`, `domain/momVariation.ts` |
| Séries do gráfico | `domain/fluxSeries.ts` |
| Totais por período | `domain/periodTotals.ts` → `@motor/dinheiro/dashboard-period.js` |
| Match facetas | `lib/dashboardExpenseFacets.ts` → `@motor/dinheiro/dashboard-facets.js` |
| Saldo API | `lib/periodBalance.ts` (reexport `api/dashboardBalance.ts`) |
| Flux hook | `hooks/useFinancialFluxChart.ts` |
| Série saldo (ano) | `domain/yearBalanceSeries.ts` → `chart-month-balance.js` |
| Splits no saldo | `domain/splitRequestsForBalance.ts` (outgoing aceitos) |
| Heatmap (cálculo) | `domain/cashHeatmap.ts` → `@motor/dinheiro/cash-heatmap.js` |

## Motor (`motor/dinheiro/`)

- `dashboard-facets.js` — entradas/saídas vs facetas do painel
- `dashboard-period.js` — `sumInPeriod`
- `account-type.js`, `cash-out-periods.js` — suporte às facetas
- `movement-date.js` — datas de movimentação
- `cash-heatmap.js` — mapa do mês e itens do dia

## Estilos

`frentes/dashboard/styles/dashboard-*.css` — tokens, superfícies, header, fluxo, ícones.

## Reexport legado

`frentes/dinheiro/dashboard/*` reexporta alguns símbolos para imports antigos; preferir `frentes/dashboard/` em código novo.