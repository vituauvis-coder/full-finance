import { formatBRL } from '../../../lib/format';
import { gainMatchesDashboardFacet, expenseMatchesDashboardFacet } from '../../../lib/dashboardExpenseFacets';
import { getPeriodDateBounds } from '../../../lib/period';
import type { Account, DashboardFacets, Movement, SplitBundle } from '../../../lib/types/finance';
import { matchesDashboardExpenseCategories } from './expenseCategoryFilter';
import type { FinanceData } from '../../../lib/types/finance';
import {
    balancoFromIncomeAndMandatory,
    computeMonthWalletFlowTotals,
    monthFlowSaldoEmConta
} from './monthWalletFlow';
import {
    walletBalanceAsOfEnd,
    walletPrimaryCashBalance,
    walletPrimaryCashFocusAccount
} from '../../dinheiro/domain/walletCashBalance';
import { computeDashboardCashBalanceAsOf } from './dashboardCashBalance';
import { sumInPeriod } from './periodTotals';
import { computeMomVariation, type MomVariationState } from './momVariation';
import { gainsWithSyntheticExpectedSplits } from './syntheticSplitGains';
import { totalExpensesMatchingSaidasList } from '../../dinheiro/domain/expensePeriodListTotal';

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
    expenseCategories?: ReadonlySet<string>
) {
    const accountById = new Map(accounts.map((a) => [a.id, a]));
    return sumInPeriod(expenses, start, end, (e) => {
        if (!matchesDashboardExpenseCategories(e.category, expenseCategories)) return false;
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
    /** Rótulo da conta quando o saldo é caixa real (conta principal). */
    balanceAccountLabel?: string | null;
    balanceAccountHolder?: string | null;
};

export async function computeDashboardMetrics(params: {
    period: string;
    civilYear: number;
    facets: DashboardFacets;
    gains: Movement[];
    expenses: Movement[];
    accounts: Account[];
    currency: string;
    expenseCategories?: ReadonlySet<string>;
    splitBundle?: SplitBundle;
    /** Quando informado, o saldo em conta usa o bundle local (conta principal incluída). */
    financeData?: FinanceData | null;
    userProfile?: FinanceData['userProfile'];
    /**
     * `saidas-list` = totais do módulo Saídas (padrão na carteira: saídas, balanço e saldo em fluxo).
     * `dashboard` = saídas só pelas facetas do painel (legado).
     */
    expenseTotalSource?: 'dashboard' | 'saidas-list';
    /** `primary-cash` = saldo calculado da conta principal (Carteira); padrão = fluxo do mês. */
    balanceMode?: 'month-flow' | 'primary-cash';
}): Promise<DashboardMetricsDisplay> {
    const expenseTotalSource = params.expenseTotalSource ?? 'saidas-list';
    const balanceMode = params.balanceMode ?? 'month-flow';
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
    const useSaidasExpenseTotal = expenseTotalSource === 'saidas-list';
    const incomeReady = params.facets.gains.size > 0;
    const expensesReady = useSaidasExpenseTotal || params.facets.expenses.size > 0;
    const projectionReady = incomeReady && expensesReady;

    const incomeNum = incomeReady
        ? sumGains(gainsForIncome, startDate, endDate, params.facets)
        : 0;
    function flowForPeriod(period: string, civilYear: number) {
        return computeMonthWalletFlowTotals(
            params.expenses,
            params.accounts,
            period,
            civilYear,
            params.splitBundle
        );
    }

    const expenseNum = !expensesReady
        ? 0
        : useSaidasExpenseTotal
          ? flowForPeriod(params.period, params.civilYear).totalOut
          : sumExpenses(
                params.expenses,
                startDate,
                endDate,
                params.facets,
                params.accounts,
                params.expenseCategories
            );

    function expenseTotalForRange(period: string, civilYear: number, rangeStart: Date, rangeEnd: Date) {
        if (useSaidasExpenseTotal) {
            return flowForPeriod(period, civilYear).totalOut;
        }
        return sumExpenses(
            params.expenses,
            rangeStart,
            rangeEnd,
            params.facets,
            params.accounts,
            params.expenseCategories
        );
    }

    function balancoForPeriod(period: string, civilYear: number, income: number) {
        if (!useSaidasExpenseTotal) {
            return income - expenseTotalForRange(period, civilYear, startDate, endDate);
        }
        const flow = flowForPeriod(period, civilYear);
        return balancoFromIncomeAndMandatory(income, flow.mandatoryOut);
    }

    function saldoFluxoForPeriod(period: string, civilYear: number, income: number) {
        if (!useSaidasExpenseTotal) {
            return null;
        }
        const flow = flowForPeriod(period, civilYear);
        return monthFlowSaldoEmConta(income, flow);
    }

    const flowCurrent = useSaidasExpenseTotal && expensesReady ? flowForPeriod(params.period, params.civilYear) : null;
    const projectionNum =
        projectionReady && flowCurrent
            ? balancoFromIncomeAndMandatory(incomeNum, flowCurrent.mandatoryOut)
            : projectionReady
              ? incomeNum - expenseNum
              : 0;

    let balanceNum: number | null = null;
    let balanceAccountLabel: string | null = null;
    let balanceAccountHolder: string | null = null;

    if (balanceMode === 'primary-cash' && params.financeData) {
        const focus = walletPrimaryCashFocusAccount(params.financeData);
        balanceAccountLabel = focus?.name?.trim() || null;
        balanceAccountHolder =
            (focus?.holderUserName ?? focus?.holderName ?? params.financeData.userProfile?.name)?.trim() || null;
        balanceNum = walletPrimaryCashBalance(params.financeData) ?? null;
        if (balanceNum == null && focus?.id) {
            const row = params.financeData.userAccounts.find((a) => String(a.id) === String(focus.id));
            if (row && typeof row.balance === 'number' && Number.isFinite(row.balance)) {
                balanceNum = row.balance;
            }
        }
    } else if (flowCurrent && useSaidasExpenseTotal) {
        balanceNum = monthFlowSaldoEmConta(incomeReady ? incomeNum : 0, flowCurrent);
    } else if (projectionReady && flowCurrent) {
        balanceNum = monthFlowSaldoEmConta(incomeNum, flowCurrent);
    } else if (projectionReady && !useSaidasExpenseTotal) {
        balanceNum = incomeNum - expenseNum;
    }

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
            expenseTotalForRange(monthPeriodFromDate(prevStart), prevStart.getFullYear(), prevStart, prevEnd),
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
        const prevPeriod = monthPeriodFromDate(prevStart);
        const prevYear = prevStart.getFullYear();
        const gainsForPrevIncome = gainsWithSyntheticExpectedSplits({
            period: prevPeriod,
            civilYear: prevYear,
            gains: params.gains,
            expenses: params.expenses,
            accounts: params.accounts,
            splitBundle: params.splitBundle
        });
        const incomePrev = sumGains(gainsForPrevIncome, prevStart, prevEnd, params.facets);
        const balancoPrev = balancoForPeriod(prevPeriod, prevYear, incomePrev);
        projectionMom = computeMomVariation(projectionNum, balancoPrev, true, false);
    } else {
        projectionMom = computeMomVariation(0, 0, false, false);
    }

    if (!isSingleMonth) {
        balanceMom = computeMomVariation(0, 0, false, false);
    } else if (balanceNum != null && balanceMode === 'primary-cash' && params.financeData) {
        const { prevEnd } = prevMonthBounds(startDate);
        const balancePrev =
            walletPrimaryCashBalance(params.financeData, walletBalanceAsOfEnd(prevEnd)) ??
            computeDashboardCashBalanceAsOf(params.financeData, prevEnd);
        balanceMom = computeMomVariation(balanceNum, balancePrev, true, false);
    } else if (balanceNum != null && projectionReady) {
        const { prevStart, prevEnd } = prevMonthBounds(startDate);
        const prevPeriod = monthPeriodFromDate(prevStart);
        const prevYear = prevStart.getFullYear();
        const gainsForPrevIncome = gainsWithSyntheticExpectedSplits({
            period: prevPeriod,
            civilYear: prevYear,
            gains: params.gains,
            expenses: params.expenses,
            accounts: params.accounts,
            splitBundle: params.splitBundle
        });
        const incomePrev = sumGains(gainsForPrevIncome, prevStart, prevEnd, params.facets);
        const saldoPrev = saldoFluxoForPeriod(prevPeriod, prevYear, incomePrev);
        if (saldoPrev != null) {
            balanceMom = computeMomVariation(balanceNum, saldoPrev, true, false);
        }
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
        balanceMom,
        balanceAccountLabel,
        balanceAccountHolder
    };
}