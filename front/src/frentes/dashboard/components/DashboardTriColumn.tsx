import { useEffect, useMemo, useState } from 'react';
import type { FinanceData } from '../../../lib/types/finance';
import { buildMonthDayMapTyped, resolveHeatmapMonth } from '../domain/cashHeatmap';
import type { DashboardMetricsDisplay } from '../domain/dashboardMetrics';
import { CashHeatmapCalendar } from './CashHeatmapCalendar';
import { DashboardMonthLedger } from './DashboardMonthLedger';
import { DashboardVisualWallet } from './DashboardVisualWallet';

type Props = {
    period: string;
    civilYear: number;
    data: FinanceData;
    currency: string;
    metrics: DashboardMetricsDisplay;
};

export function DashboardTriColumn({ period, civilYear, data, currency, metrics }: Props) {
    const { year, monthIndex } = resolveHeatmapMonth(period, civilYear);
    const [ledgerScope, setLedgerScope] = useState<'day' | 'month'>('month');
    const [selectedDay, setSelectedDay] = useState<number | null>(null);

    useEffect(() => {
        setLedgerScope('month');
        setSelectedDay(null);
    }, [year, monthIndex]);

    const dayMap = useMemo(
        () => buildMonthDayMapTyped(data.userExpenses, data.userGains, data.userAccounts, year, monthIndex),
        [data.userExpenses, data.userGains, data.userAccounts, year, monthIndex]
    );

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

    return (
        <div className="dashboard-tri-column" aria-label="Carteira, calendário e extrato">
            <DashboardVisualWallet
                data={data}
                period={period}
                civilYear={civilYear}
                currency={currency}
                metrics={metrics}
            />
            <section className="dashboard-tri-col dashboard-tri-col--heatmap">
                <CashHeatmapCalendar
                    year={year}
                    monthIndex={monthIndex}
                    dayMap={dayMap}
                    selectedDay={selectedDay}
                    currency={currency}
                    onSelectDay={onSelectDay}
                    compact
                />
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
            />
        </div>
    );
}