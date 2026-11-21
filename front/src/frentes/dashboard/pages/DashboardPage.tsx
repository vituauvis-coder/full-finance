import { useEffect, useState } from 'react';
import { CivilPeriodToolbar } from '../../../components/finance/CivilPeriodToolbar';
import { DashboardSummaryCards } from '../../../components/finance/MovementSummaryCards';
import { useFinanceData } from '../../../app/FinanceDataProvider';
import { useCivilPeriodState } from '../../../hooks/useCivilPeriodState';
import { CashHeatmap } from '../components/CashHeatmap';
import { FinancialFluxChart } from '../components/FinancialFluxChart';
import { PendingCashOuts } from '../components/PendingCashOuts';
import { useDashboardFacets } from '../context/DashboardFacetsContext';
import { computeDashboardMetrics, type DashboardMetricsDisplay } from '../domain/dashboardMetrics';
import { acceptedOutgoingSplits } from '../domain/splitRequestsForBalance';
import { DashboardPageSkeleton } from '../../../components/skeleton/DashboardPageSkeleton';
import { useSkeletonMinDuration } from '../../../hooks/useSkeletonMinDuration';

const EMPTY_METRICS: DashboardMetricsDisplay = {
    balance: '—',
    income: '—',
    expenses: '—',
    projection: '—',
    incomeReady: false,
    expensesReady: false,
    projectionReady: false,
    incomeMom: { kind: 'hidden' },
    expensesMom: { kind: 'hidden' },
    projectionMom: { kind: 'hidden' },
    balanceMom: { kind: 'hidden' }
};

export function DashboardPage() {
    const { data, loading, error } = useFinanceData();
    const showSkeleton = useSkeletonMinDuration(loading);
    const facetsCtx = useDashboardFacets();
    const { period, year, onPeriodChange, onYearChange, selectChartMonth } = useCivilPeriodState();
    const [cards, setCards] = useState<DashboardMetricsDisplay>(EMPTY_METRICS);

    const currency = data?.userProfile?.currency ?? 'BRL';
    const facets = facetsCtx?.facets ?? { gains: new Set<'paid' | 'unpaid'>(), expenses: new Set() };
    const expenseCategory = facetsCtx?.expenseCategory ?? '';
    const facetKey =
        [...facets.gains].sort().join(',') +
        '|' +
        [...facets.expenses].sort().join(',') +
        '|' +
        expenseCategory;

    useEffect(() => {
        if (!data) return;
        let cancelled = false;
        void computeDashboardMetrics({
            period,
            civilYear: year,
            facets,
            gains: data.userGains,
            expenses: data.userExpenses,
            accounts: data.userAccounts,
            currency,
            expenseCategory: expenseCategory || undefined,
            splitBundle: data.expenseSplitRequests
        }).then((next) => {
            if (!cancelled) setCards(next);
        });
        return () => {
            cancelled = true;
        };
    }, [data, period, year, facetKey, currency, facets]);

    if (showSkeleton) {
        return <DashboardPageSkeleton />;
    }

    if (error || !data) {
        return (
            <section className="page active">
                <p role="alert">{error ?? 'Sem dados'}</p>
            </section>
        );
    }

    return (
        <section id="dashboard-page" className="page active dashboard-page--modern">
            <CivilPeriodToolbar
                period={period}
                year={year}
                onPeriodChange={onPeriodChange}
                onYearChange={onYearChange}
                accent="dashboard"
            />
            <DashboardSummaryCards {...cards} />
            <PendingCashOuts currency={currency} />
            <FinancialFluxChart
                period={period}
                civilYear={year}
                gains={data.userGains}
                expenses={data.userExpenses}
                accounts={data.userAccounts}
                facets={facets}
                expenseCategory={expenseCategory || undefined}
                currency={currency}
                userProfile={data.userProfile}
                splitRequests={acceptedOutgoingSplits(data.expenseSplitRequests)}
                splitBundle={data.expenseSplitRequests}
                onSelectMonth={selectChartMonth}
            />
            <CashHeatmap
                period={period}
                civilYear={year}
                gains={data.userGains}
                expenses={data.userExpenses}
                accounts={data.userAccounts}
                currency={currency}
            />
            <footer className="beta-footer">
                <span data-app-brand="beta-footer">Meu Mundo — React</span>
            </footer>
        </section>
    );
}