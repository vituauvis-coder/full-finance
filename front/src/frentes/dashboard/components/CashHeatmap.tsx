import { useMemo, useState } from 'react';
import { buildDayDetailItemsTyped, buildMonthDayMapTyped, resolveHeatmapMonth } from '../domain/cashHeatmap';
import type { Account, Movement } from '../../../lib/types/finance';
import { CashHeatmapCalendar } from './CashHeatmapCalendar';
import { CashHeatmapDayPanel } from './CashHeatmapDayPanel';

type Props = {
    period: string;
    civilYear: number;
    gains: Movement[];
    expenses: Movement[];
    accounts: Account[];
    currency: string;
};

export function CashHeatmap({ period, civilYear, gains, expenses, accounts, currency }: Props) {
    const { year, monthIndex } = resolveHeatmapMonth(period, civilYear);
    const today = new Date();
    const defaultDay =
        today.getFullYear() === year && today.getMonth() === monthIndex ? today.getDate() : 1;
    const [selectedDay, setSelectedDay] = useState(defaultDay);

    const dayMap = useMemo(
        () => buildMonthDayMapTyped(expenses, gains, accounts, year, monthIndex),
        [expenses, gains, accounts, year, monthIndex]
    );

    const detailItems = useMemo(
        () => buildDayDetailItemsTyped(expenses, gains, accounts, year, monthIndex, selectedDay),
        [expenses, gains, accounts, year, monthIndex, selectedDay]
    );

    return (
        <div className="dashboard-cash-heatmap list-container" aria-label="Heatmap de caixa">
            <div className="dashboard-cash-heatmap__layout">
                <CashHeatmapCalendar
                    year={year}
                    monthIndex={monthIndex}
                    dayMap={dayMap}
                    selectedDay={selectedDay}
                    currency={currency}
                    onSelectDay={setSelectedDay}
                />
                <div className="dashboard-cash-heatmap__divider" aria-hidden="true"></div>
                <CashHeatmapDayPanel
                    year={year}
                    monthIndex={monthIndex}
                    selectedDay={selectedDay}
                    items={detailItems}
                    currency={currency}
                />
            </div>
        </div>
    );
}