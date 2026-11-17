import {
    buildDayDetailItems,
    buildInvoicesByDueDay,
    buildMonthDayMap,
    sumCardExpensesInMonth
} from '../../../../motor/dinheiro/cash-heatmap.js';
import { getDashboardCivilYearFromDom, getPeriodDateBounds } from '../../core/period-filters.js';

export { buildDayDetailItems, buildInvoicesByDueDay, buildMonthDayMap, sumCardExpensesInMonth };

const MONTH_NAMES_PT = [
    'Janeiro',
    'Fevereiro',
    'Março',
    'Abril',
    'Maio',
    'Junho',
    'Julho',
    'Agosto',
    'Setembro',
    'Outubro',
    'Novembro',
    'Dezembro'
];

export function formatHeatmapMonthLabel(year, monthIndex) {
    return `${MONTH_NAMES_PT[monthIndex]} ${year}`;
}

export function resolveHeatmapMonthFromPeriod(period, now = new Date()) {
    const monthMatch = /^month-(\d+)$/.exec(period || '');
    if (monthMatch) {
        const mi = Math.min(11, Math.max(0, parseInt(monthMatch[1], 10)));
        return { year: getDashboardCivilYearFromDom(), monthIndex: mi };
    }
    if (period === 'current-year') {
        return { year: now.getFullYear(), monthIndex: now.getMonth() };
    }
    const { startDate, endDate } = getPeriodDateBounds(period, now);
    const t = now.getTime();
    if (t >= startDate.getTime() && t <= endDate.getTime()) {
        return { year: now.getFullYear(), monthIndex: now.getMonth() };
    }
    return { year: endDate.getFullYear(), monthIndex: endDate.getMonth() };
}

export function getDefaultSelectedDay(year, monthIndex, now = new Date()) {
    if (now.getFullYear() === year && now.getMonth() === monthIndex) {
        return now.getDate();
    }
    return 1;
}

export function clampSelectedDay(day, year, monthIndex) {
    const last = new Date(year, monthIndex + 1, 0).getDate();
    return Math.min(last, Math.max(1, day));
}