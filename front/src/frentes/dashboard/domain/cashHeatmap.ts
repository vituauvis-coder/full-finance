import { buildDayDetailItems, buildMonthDayMap } from '@motor/dinheiro/cash-heatmap.js';
import { isCivilYearPeriod, monthIndexFromPeriod } from '../../../lib/period';
import { buildYearMonthMap } from '@motor/dinheiro/cash-heatmap.js';
import type { Account, Movement } from '../../../lib/types/finance';
import type { DayAgg, DayDetailItem } from '../types/cashHeatmap';

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

export type { DayAgg, DayDetailItem };

export function formatHeatmapMonthLabel(year: number, monthIndex: number) {
    return `${MONTH_NAMES_PT[monthIndex]} ${year}`;
}

export function resolveHeatmapMonth(period: string, civilYear: number, now = new Date()) {
    if (isCivilYearPeriod(period)) {
        const monthIndex = civilYear === now.getFullYear() ? now.getMonth() : 11;
        return { year: civilYear, monthIndex, yearScope: true as const };
    }
    const monthIndex = monthIndexFromPeriod(period);
    return { year: civilYear, monthIndex, yearScope: false as const };
}

export function buildYearMonthMapTyped(
    expenses: Movement[],
    gains: Movement[],
    accounts: Account[],
    year: number
): Map<number, DayAgg> {
    return buildYearMonthMap(expenses, gains, accounts, year);
}

export function buildMonthDayMapTyped(
    expenses: Movement[],
    gains: Movement[],
    accounts: Account[],
    year: number,
    monthIndex: number
): Map<number, DayAgg> {
    return buildMonthDayMap(expenses, gains, accounts, year, monthIndex);
}

export function buildDayDetailItemsTyped(
    expenses: Movement[],
    gains: Movement[],
    accounts: Account[],
    year: number,
    monthIndex: number,
    day: number
): DayDetailItem[] {
    return buildDayDetailItems(expenses, gains, accounts, year, monthIndex, day);
}