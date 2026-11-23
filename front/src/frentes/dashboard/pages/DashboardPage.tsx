import { useEffect, useState } from 'react';
import { CivilPeriodToolbar } from '../../../components/finance/CivilPeriodToolbar';
import { DashboardTriColumn } from '../components/DashboardTriColumn';
import { useFinanceData } from '../../../app/FinanceDataProvider';
import { useCivilPeriodState } from '../../../hooks/useCivilPeriodState';
import { FinancialFluxChart } from '../components/FinancialFluxChart';
import { useDashboardFacets } from '../context/DashboardFacetsContext';
import { computeDashboardMetrics, type DashboardMetricsDisplay } from '../domain/dashboardMetrics';
import { acceptedOutgoingSplits } from '../domain/splitRequestsForBalance';
import { DashboardPageSkeleton } from '../../../components/skeleton/DashboardPageSkeleton';
import { useFinanceShellVeil } from '../../../hooks/useFinanceShellVeil';

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
    const { data, error } = useFinanceData();
    const showSkeleton = useFinanceShellVeil('dashboard');
    const facetsCtx = useDashboardFacets();
    const { period, year, onPeriodChange, onYearChange, selectChartMonth } = useCivilPeriodState();
    const [cards, setCards] = useState<DashboardMetricsDisplay>(EMPTY_METRICS);

    const currency = data?.userProfile?.currency ?? 'BRL';
    const facets = facetsCtx?.facets ?? { gains: new Set<'paid' | 'unpaid'>(), expenses: new Set() };
    const expenseCategories = facetsCtx?.expenseCategories ?? new Set<string>();
    const expenseCategoriesKey = [...expenseCategories].sort().join('|');
    const facetKey =
        [...facets.gains].sort().join(',') +
        '|' +
        [...facets.expenses].sort().join(',') +
        '|' +
        expenseCategoriesKey;

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
            expenseCategories: expenseCategories.size > 0 ? expenseCategories : undefined,
            splitBundle: data.expenseSplitRequests,
            financeData: data,
            userProfile: data.userProfile
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
        <section id="dashboard-page" className="page active dashboard-page--modern dashboard-page--compact">
            <CivilPeriodToolbar
                period={period}
                year={year}
                onPeriodChange={onPeriodChange}
                onYearChange={onYearChange}
                accent="dashboard"
            />
            <DashboardTriColumn period={period} civilYear={year} data={data} currency={currency} metrics={cards} />
            <FinancialFluxChart
                period={period}
                civilYear={year}
                gains={data.userGains}
                expenses={data.userExpenses}
                accounts={data.userAccounts}
                facets={facets}
                expenseCategories={expenseCategories.size > 0 ? expenseCategories : undefined}
                currency={currency}
                userProfile={data.userProfile}
                splitRequests={acceptedOutgoingSplits(data.expenseSplitRequests)}
                splitBundle={data.expenseSplitRequests}
                onSelectMonth={selectChartMonth}
            />
        </section>
    );
}