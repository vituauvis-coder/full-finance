import type { Account, Movement } from '../../../lib/types/finance';
import type { DayDetailItem } from '../types/cashHeatmap';
import { buildDayDetailItemsTyped } from './cashHeatmap';

export type LedgerItem = DayDetailItem & { day: number; monthIndex?: number };

export function buildYearLedgerItems(
    expenses: Movement[],
    gains: Movement[],
    accounts: Account[],
    year: number,
    filterMonthIndex?: number | null
): LedgerItem[] {
    const months =
        filterMonthIndex != null && filterMonthIndex >= 0 && filterMonthIndex <= 11
            ? [filterMonthIndex]
            : Array.from({ length: 12 }, (_, i) => i);
    const out: LedgerItem[] = [];
    for (const monthIndex of months) {
        const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
        for (let day = 1; day <= daysInMonth; day++) {
            for (const it of buildDayDetailItemsTyped(expenses, gains, accounts, year, monthIndex, day)) {
                out.push({ ...it, id: `${monthIndex}:${day}:${it.id}`, day, monthIndex });
            }
        }
    }
    out.sort((a, b) => {
        const am = a.monthIndex ?? 0;
        const bm = b.monthIndex ?? 0;
        if (am !== bm) return bm - am;
        if (a.day !== b.day) return b.day - a.day;
        return b.amount - a.amount;
    });
    return out;
}

export function buildMonthLedgerItems(
    expenses: Movement[],
    gains: Movement[],
    accounts: Account[],
    year: number,
    monthIndex: number,
    filterDay?: number | null
): LedgerItem[] {
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const days = filterDay != null ? [filterDay] : Array.from({ length: daysInMonth }, (_, i) => i + 1);
    const out: LedgerItem[] = [];
    for (const day of days) {
        for (const it of buildDayDetailItemsTyped(expenses, gains, accounts, year, monthIndex, day)) {
            out.push({ ...it, id: `${day}:${it.id}`, day });
        }
    }
    if (filterDay != null) {
        out.sort((a, b) => b.amount - a.amount);
    } else {
        out.sort((a, b) => b.day - a.day || b.amount - a.amount);
    }
    return out;
}