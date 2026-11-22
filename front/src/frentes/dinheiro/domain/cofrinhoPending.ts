import type { Movement } from '../../../lib/types/finance';
import { MONTH_NAMES } from '../../../lib/period';
import { isCofrinhoPoolExpense } from './cofrinhoAggregations';
import { toYearMonthKey } from './cofrinhoPeriod';
import { movementDate } from '../../../lib/period';

export type CofrinhoPoolPendingMonth = {
    yearMonth: string;
    label: string;
    amount: number;
};

function expenseYearMonth(e: Movement): string {
    const d = e.date;
    if (typeof d === 'string' && d.trim()) return toYearMonthKey(d);
    try {
        return toYearMonthKey(movementDate(e).toISOString());
    } catch {
        return '';
    }
}

function monthLabel(ym: string): string {
    if (!/^\d{4}-\d{2}$/.test(ym)) return ym;
    const [y, m] = ym.split('-');
    const mi = Math.min(11, Math.max(0, parseInt(m, 10) - 1));
    return `${MONTH_NAMES[mi]}/${y}`;
}

/** Saídas Pool pagas agrupadas por mês civil (aguardando distribuição). */
export function listCofrinhoPoolPendingByMonth(expenses: Movement[]): CofrinhoPoolPendingMonth[] {
    const totals = new Map<string, number>();
    for (const e of expenses ?? []) {
        if (!isCofrinhoPoolExpense(e) || e.isPaid === false) continue;
        const ym = expenseYearMonth(e);
        if (!ym) continue;
        totals.set(ym, (totals.get(ym) ?? 0) + (Number(e.amount) || 0));
    }
    return [...totals.entries()]
        .filter(([, amount]) => amount > 0.001)
        .sort((a, b) => b[0].localeCompare(a[0]))
        .map(([yearMonth, amount]) => ({
            yearMonth,
            label: monthLabel(yearMonth),
            amount: Math.round(amount * 100) / 100
        }));
}

export function totalCofrinhoPoolPending(expenses: Movement[]): number {
    return Math.round(listCofrinhoPoolPendingByMonth(expenses).reduce((s, r) => s + r.amount, 0) * 100) / 100;
}

/** Mês civil cujo saldo Pool o backend usa na distribuição (não é o mês “atual” da página). */
export function pickPoolYearMonthForAllocation(
    explicit: string | null | undefined,
    pending: CofrinhoPoolPendingMonth[],
    fallback: string
): string {
    if (explicit && /^\d{4}-\d{2}$/.test(explicit)) return explicit;
    const hit = pending.find((p) => p.amount > 0.001);
    if (hit) return hit.yearMonth;
    return fallback;
}