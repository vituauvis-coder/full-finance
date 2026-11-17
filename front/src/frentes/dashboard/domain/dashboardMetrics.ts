import { formatBRL } from '../../../lib/format';
import { gainMatchesDashboardFacet, expenseMatchesDashboardFacet } from '../../../lib/dashboardExpenseFacets';
import { getPeriodDateBounds } from '../../../lib/period';
import type { Account, DashboardFacets, Movement, SplitBundle } from '../../../lib/types/finance';
import { fetchPeriodBalance } from '../api/dashboardBalance';
import { sumInPeriod } from './periodTotals';
import { computeMomVariation, type MomVariationState } from './momVariation';
import { gainsWithSyntheticExpectedSplits } from './syntheticSplitGains';

function prevMonthBounds(startDate: Date) {
    const prevStart = new Date(startDate.getFullYear(), startDate.getMonth() - 1, 1);
    const prevEnd = new Date(startDate.getFullYear(), startDate.getMonth(), 0, 23, 59, 59, 999);
    return { prevStart, prevEnd };
}

function monthPeriodFromDate(d: Date) {
    return `month-${d.getMonth() + 1}`;
}

function sumGains(gains: Movement[], start: Date, end: Date, facets: DashboardFacets) {
    return sumInPeriod(gains, start, end, (g) => gainMatchesDashboardFacet(g, facets.gains));
}

function sumExpenses(
    expenses: Movement[],
    start: Date,
    end: Date,
    facets: DashboardFacets,
    accounts: Account[],
    expenseCategory?: string
) {
    const accountById = new Map(accounts.map((a) => [a.id, a]));
    return sumInPeriod(expenses, start, end, (e) => {
        if (expenseCategory && (e.category || '') !== expenseCategory) return false;
        return expenseMatchesDashboardFacet(e, accountById.get(String(e.accountId)), facets.expenses);
    });
}

export type DashboardMetricsDisplay = {
    balance: string;
    income: string;
    expenses: string;
    projection: string;
    incomeReady: boolean;
    expensesReady: boolean;
    projectionReady: boolean;
    incomeMom: MomVariationState;
    expensesMom: MomVariationState;
    projectionMom: MomVariationState;
    balanceMom: MomVariationState;
};

export async function computeDashboardMetrics(params: {
    period: string;
    civilYear: number;
    facets: DashboardFacets;
    gains: Movement[];
    expenses: Movement[];
    accounts: Account[];
    currency: string;
    expenseCategory?: string;
    splitBundle?: SplitBundle;
}): Promise<DashboardMetricsDisplay> {
    const { startDate, endDate } = getPeriodDateBounds(params.period, params.civilYear);
    const gainsForIncome = gainsWithSyntheticExpectedSplits({
        period: params.period,
        civilYear: params.civilYear,
        gains: params.gains,
        expenses: params.expenses,
        accounts: params.accounts,
        splitBundle: params.splitBundle
    });
    const isSingleMonth = /^month-\d+$/.test(params.period || '');
    const incomeReady = params.facets.gains.size > 0;
    const expensesReady = params.facets.expenses.size > 0;
    const projectionReady = incomeReady && expensesReady;

    const incomeNum = incomeReady
        ? sumGains(gainsForIncome, startDate, endDate, params.facets)
        : 0;
    const expenseNum = expensesReady
        ? sumExpenses(params.expenses, startDate, endDate, params.facets, params.accounts, params.expenseCategory)
        : 0;

    const balanceNum = await fetchPeriodBalance(startDate, endDate);
    const projectionNum = incomeNum - expenseNum;

    let incomeMom: MomVariationState = { kind: 'hidden' };
    let expensesMom: MomVariationState = { kind: 'hidden' };
    let projectionMom: MomVariationState = { kind: 'hidden' };
    let balanceMom: MomVariationState = { kind: 'hidden' };

    if (!incomeReady) {
        incomeMom = { kind: 'hidden' };
    } else if (isSingleMonth) {
        const { prevStart, prevEnd } = prevMonthBounds(startDate);
        const gainsForPrevIncome = gainsWithSyntheticExpectedSplits({
            period: monthPeriodFromDate(prevStart),
            civilYear: prevStart.getFullYear(),
            gains: params.gains,
            expenses: params.expenses,
            accounts: params.accounts,
            splitBundle: params.splitBundle
        });
        incomeMom = computeMomVariation(
            incomeNum,
            sumGains(gainsForPrevIncome, prevStart, prevEnd, params.facets),
            true,
            false
        );
    } else {
        incomeMom = computeMomVariation(0, 0, false, false);
    }

    if (!expensesReady) {
        expensesMom = { kind: 'hidden' };
    } else if (isSingleMonth) {
        const { prevStart, prevEnd } = prevMonthBounds(startDate);
        expensesMom = computeMomVariation(
            expenseNum,
            sumExpenses(params.expenses, prevStart, prevEnd, params.facets, params.accounts, params.expenseCategory),
            true,
            true
        );
    } else {
        expensesMom = computeMomVariation(0, 0, false, true);
    }

    if (!projectionReady) {
        projectionMom = { kind: 'hidden' };
    } else if (isSingleMonth) {
        const { prevStart, prevEnd } = prevMonthBounds(startDate);
        const gainsForPrevIncome = gainsWithSyntheticExpectedSplits({
            period: monthPeriodFromDate(prevStart),
            civilYear: prevStart.getFullYear(),
            gains: params.gains,
            expenses: params.expenses,
            accounts: params.accounts,
            splitBundle: params.splitBundle
        });
        const netPrev =
            sumGains(gainsForPrevIncome, prevStart, prevEnd, params.facets) -
            sumExpenses(params.expenses, prevStart, prevEnd, params.facets, params.accounts, params.expenseCategory);
        projectionMom = computeMomVariation(projectionNum, netPrev, true, false);
    } else {
        projectionMom = computeMomVariation(0, 0, false, false);
    }

    if (!isSingleMonth) {
        balanceMom = computeMomVariation(0, 0, false, false);
    } else if (balanceNum != null) {
        const { prevStart, prevEnd } = prevMonthBounds(startDate);
        const balancePrev = await fetchPeriodBalance(prevStart, prevEnd);
        balanceMom = computeMomVariation(balanceNum, balancePrev ?? 0, true, false);
    }

    return {
        balance: balanceNum != null ? formatBRL(balanceNum, params.currency) : '—',
        income: formatBRL(incomeNum, params.currency),
        expenses: formatBRL(expenseNum, params.currency),
        projection: formatBRL(projectionNum, params.currency),
        incomeReady,
        expensesReady,
        projectionReady,
        incomeMom,
        expensesMom,
        projectionMom,
        balanceMom
    };
}