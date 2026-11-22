import { useEffect, useMemo, useState } from 'react';
import type { FinanceData } from '../../../../lib/types/finance';
import {
    buildMonthDayMapTyped,
    buildYearMonthMapTyped,
    resolveHeatmapMonth
} from '../../../dashboard/domain/cashHeatmap';
import { CashHeatmapCalendar } from '../../../dashboard/components/CashHeatmapCalendar';
import { CashHeatmapYearGrid } from '../../../dashboard/components/CashHeatmapYearGrid';
import { periodFromMonthIndex } from '../../../../lib/period';
import { DashboardMonthLedger } from '../../../dashboard/components/DashboardMonthLedger';
import { DashboardVisualWallet } from '../../../dashboard/components/DashboardVisualWallet';
import { loadDashboardFacetsFromStorage } from '../../../dashboard/domain/dashboardFacetStorage';
import {
    computeDashboardMetrics,
    type DashboardMetricsDisplay
} from '../../../dashboard/domain/dashboardMetrics';

type Props = {
    period: string;
    civilYear: number;
    data: FinanceData;
    currency: string;
    onPeriodChange: (period: string) => void;
};

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

export function WalletTriPanel({ period, civilYear, data, currency, onPeriodChange }: Props) {
    const facets = useMemo(() => loadDashboardFacetsFromStorage(), []);
    const { year, monthIndex, yearScope } = resolveHeatmapMonth(period, civilYear);
    const [ledgerScope, setLedgerScope] = useState<'day' | 'month'>('month');
    const [selectedDay, setSelectedDay] = useState<number | null>(null);
    const [metrics, setMetrics] = useState<DashboardMetricsDisplay>(EMPTY_METRICS);

    useEffect(() => {
        setLedgerScope('month');
        setSelectedDay(null);
    }, [year, monthIndex, yearScope]);

    function onSelectDay(day: number) {
        setSelectedDay(day);
        setLedgerScope('day');
    }

    function onLedgerScopeChange(next: 'day' | 'month') {
        setLedgerScope(next);
        if (next === 'month') setSelectedDay(null);
        if (next === 'day' && selectedDay == null) {
            const today = new Date();
            const fallback =
                today.getFullYear() === year && today.getMonth() === monthIndex ? today.getDate() : 1;
            setSelectedDay(fallback);
        }
    }

    useEffect(() => {
        let cancelled = false;
        void computeDashboardMetrics({
            period,
            civilYear,
            facets,
            gains: data.userGains,
            expenses: data.userExpenses,
            accounts: data.userAccounts,
            currency,
            splitBundle: data.expenseSplitRequests,
            financeData: data,
            userProfile: data.userProfile,
            expenseTotalSource: 'saidas-list'
        }).then((next) => {
            if (!cancelled) setMetrics(next);
        });
        return () => {
            cancelled = true;
        };
    }, [data, period, civilYear, currency, facets]);

    const dayMap = useMemo(
        () => buildMonthDayMapTyped(data.userExpenses, data.userGains, data.userAccounts, year, monthIndex),
        [data.userExpenses, data.userGains, data.userAccounts, year, monthIndex]
    );

    const yearMonthMap = useMemo(
        () => buildYearMonthMapTyped(data.userExpenses, data.userGains, data.userAccounts, year),
        [data.userExpenses, data.userGains, data.userAccounts, year]
    );

    const onSelectHeatmapMonth = (mi: number) => {
        onPeriodChange(periodFromMonthIndex(mi));
    };

    return (
        <div className="wallet-tri-column dashboard-tri-column" aria-label="Carteira, calendário e extrato">
            <DashboardVisualWallet
                data={data}
                period={period}
                civilYear={civilYear}
                currency={currency}
                metrics={metrics}
                showCta={false}
            />
            <section className="dashboard-tri-col dashboard-tri-col--heatmap">
                {yearScope ? (
                    <CashHeatmapYearGrid
                        year={year}
                        monthMap={yearMonthMap}
                        currency={currency}
                        onSelectMonth={onSelectHeatmapMonth}
                        compact
                    />
                ) : (
                    <CashHeatmapCalendar
                        year={year}
                        monthIndex={monthIndex}
                        dayMap={dayMap}
                        selectedDay={selectedDay}
                        currency={currency}
                        onSelectDay={onSelectDay}
                        compact
                    />
                )}
            </section>
            <DashboardMonthLedger
                year={year}
                monthIndex={monthIndex}
                selectedDay={selectedDay}
                scope={ledgerScope}
                onScopeChange={onLedgerScopeChange}
                expenses={data.userExpenses}
                gains={data.userGains}
                accounts={data.userAccounts}
                currency={currency}
                userProfile={data.userProfile}
                splitBundle={data.expenseSplitRequests}
                civilYearScope={yearScope}
                embedded
            />
        </div>
    );
}