import { gainMatchesDashboardFacet } from '../../../lib/dashboardExpenseFacets';
import { getPeriodDateBounds, periodFromMonthIndex } from '../../../lib/period';
import type { DashboardFacets, FinanceData } from '../../../lib/types/finance';
import { loadDashboardFacetsFromStorage } from './dashboardFacetStorage';
import { computeMonthWalletFlowTotals, monthFlowSaldoEmConta } from './monthWalletFlow';
import { sumInPeriod } from './periodTotals';
import { gainsWithSyntheticExpectedSplits } from './syntheticSplitGains';

/** Saldo em conta do mês: balanço − outras despesas (extras/cofrinhos), regra da Carteira. */
export function computeWalletMonthFlowSaldoEmContaForPeriod(
    data: FinanceData,
    period: string,
    civilYear: number,
    facets?: DashboardFacets
): number {
    const f = facets ?? loadDashboardFacetsFromStorage();
    const { startDate, endDate } = getPeriodDateBounds(period, civilYear);
    let income = 0;
    if (f.gains.size > 0) {
        const gainsForIncome = gainsWithSyntheticExpectedSplits({
            period,
            civilYear,
            gains: data.userGains ?? [],
            expenses: data.userExpenses ?? [],
            accounts: data.userAccounts,
            splitBundle: data.expenseSplitRequests
        });
        income = sumInPeriod(gainsForIncome, startDate, endDate, (g) =>
            gainMatchesDashboardFacet(g, f.gains)
        );
    }
    const flow = computeMonthWalletFlowTotals(
        data.userExpenses ?? [],
        data.userAccounts,
        period,
        civilYear,
        data.expenseSplitRequests
    );
    return monthFlowSaldoEmConta(income, flow);
}

export function computeWalletMonthFlowSaldoEmConta(
    data: FinanceData,
    year: number,
    monthIndex: number,
    facets?: DashboardFacets
): number {
    const period = periodFromMonthIndex(monthIndex);
    return computeWalletMonthFlowSaldoEmContaForPeriod(data, period, year, facets);
}