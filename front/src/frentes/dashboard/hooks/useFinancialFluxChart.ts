import { useEffect, useMemo, useState } from 'react';
import { buildSelectedMonthDailySeries, buildYearFluxSeries } from '../domain/fluxSeries';
import { acceptedOutgoingSplits } from '../domain/splitRequestsForBalance';
import { FLUX_CHART_SYNTHETIC_PERIOD, gainsWithSyntheticExpectedSplits } from '../domain/syntheticSplitGains';
import { fetchYearBalanceSeries } from '../domain/yearBalanceSeries';
import { MONTH_NAMES, monthIndexFromPeriod } from '../../../lib/period';
import type { Account, DashboardFacets, Movement, SplitBundle, UserProfile } from '../../../lib/types/finance';

export const REPORTS_CHART_SHOW_SALDO_TOTAL_KEY = 'reports.financialChart.showSaldoTotal';

export type FluxChartSeries = {
    labels: string[];
    gainData: number[];
    expenseFixedData: number[];
    expenseInvoiceData: number[];
    expenseExtraData: number[];
    expenseCofrinhoData: number[];
    expenseData: number[];
    netData: number[];
    balanceData: (number | null)[];
};

export type FluxChartScope = 'year' | 'month';
export type FluxChartViz = 'bar' | 'line';

export function readShowSaldoTotal(): boolean {
    try {
        return localStorage.getItem(REPORTS_CHART_SHOW_SALDO_TOTAL_KEY) === '1';
    } catch {
        return false;
    }
}

export function writeShowSaldoTotal(show: boolean) {
    try {
        localStorage.setItem(REPORTS_CHART_SHOW_SALDO_TOTAL_KEY, show ? '1' : '0');
    } catch {
        /* ignore */
    }
}

export function useFinancialFluxChart(params: {
    period: string;
    civilYear: number;
    gains: Movement[];
    expenses: Movement[];
    accounts: Account[];
    facets: DashboardFacets;
    expenseCategories?: ReadonlySet<string>;
    chartType: FluxChartScope;
    userProfile?: UserProfile | null;
    splitRequests?: unknown[] | null;
    splitBundle?: SplitBundle;
}) {
    const [showSaldoTotal, setShowSaldoTotal] = useState(readShowSaldoTotal);
    const [balanceData, setBalanceData] = useState<(number | null)[]>([]);
    const [balanceLoading, setBalanceLoading] = useState(false);

    const gainsForFlux = useMemo(() => {
        const synthPeriod =
            params.chartType === 'year' ? FLUX_CHART_SYNTHETIC_PERIOD : params.period;
        return gainsWithSyntheticExpectedSplits({
            period: synthPeriod,
            civilYear: params.civilYear,
            gains: params.gains,
            expenses: params.expenses,
            accounts: params.accounts,
            splitBundle: params.splitBundle
        });
    }, [
        params.chartType,
        params.period,
        params.civilYear,
        params.gains,
        params.expenses,
        params.accounts,
        params.splitBundle
    ]);

    const expenseSplits = useMemo(
        () => acceptedOutgoingSplits(params.splitBundle),
        [params.splitBundle]
    );

    const baseSeries = useMemo(() => {
        if (params.chartType === 'month') {
            return buildSelectedMonthDailySeries(
                gainsForFlux,
                params.expenses,
                params.period,
                params.civilYear,
                params.facets,
                params.accounts,
                expenseSplits,
                params.expenseCategories
            );
        }
        return buildYearFluxSeries(
            gainsForFlux,
            params.expenses,
            params.civilYear,
            params.facets,
            params.accounts,
            expenseSplits,
            params.expenseCategories
        );
    }, [gainsForFlux, expenseSplits, params]);

    useEffect(() => {
        if (!showSaldoTotal || params.chartType !== 'year') {
            setBalanceData([]);
            setBalanceLoading(false);
            return;
        }
        let cancelled = false;
        setBalanceLoading(true);
        void (async () => {
            try {
                const balances = await fetchYearBalanceSeries({
                    civilYear: params.civilYear,
                    gains: params.gains,
                    expenses: params.expenses,
                    accounts: params.accounts,
                    userProfile: params.userProfile,
                    splitRequests: params.splitRequests
                });
                if (!cancelled) setBalanceData(balances);
            } finally {
                if (!cancelled) setBalanceLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [
        showSaldoTotal,
        params.chartType,
        params.civilYear,
        params.gains,
        params.expenses,
        params.accounts,
        params.userProfile,
        params.splitRequests
    ]);

    const series: FluxChartSeries = useMemo(
        () => ({
            ...baseSeries,
            balanceData: showSaldoTotal && params.chartType === 'year' ? balanceData : []
        }),
        [baseSeries, balanceData, showSaldoTotal, params.chartType]
    );

    const monthLabel = MONTH_NAMES[monthIndexFromPeriod(params.period)];
    const title =
        params.chartType === 'month'
            ? `Fluxo diário — ${monthLabel} ${params.civilYear}`
            : `Fluxo ${params.civilYear}`;

    const toggleSaldoTotal = () => {
        setShowSaldoTotal((v) => {
            const next = !v;
            writeShowSaldoTotal(next);
            return next;
        });
    };

    const monthIndexForHighlight = monthIndexFromPeriod(params.period);

    return {
        series,
        title,
        showSaldoTotal,
        balanceLoading,
        toggleSaldoTotal,
        monthIndexForHighlight
    };
}