import { getPeriodDateBounds, movementDate } from './period';
import type { Account, Movement } from './types/finance';

export type ListFilter = {
    q?: string;
    paymentStatus?: Set<'paid' | 'unpaid'>;
    accountId?: string;
    category?: string;
    amountMin?: number | null;
    amountMax?: number | null;
    dateFrom?: string;
    dateTo?: string;
};

function movementMatchesDateRange(m: Movement, fromStr?: string, toStr?: string) {
    if (!fromStr && !toStr) return true;
    const d = movementDate(m);
    if (fromStr) {
        const from = new Date(`${fromStr}T00:00:00`);
        if (d.getTime() < from.getTime()) return false;
    }
    if (toStr) {
        const to = new Date(`${toStr}T23:59:59`);
        if (d.getTime() > to.getTime()) return false;
    }
    return true;
}

function matchesSearch(m: Movement, q: string) {
    if (!q.trim()) return true;
    const hay = `${m.description ?? ''} ${m.category ?? ''} ${m.subcategory ?? ''}`.toLowerCase();
    return hay.includes(q.trim().toLowerCase());
}

function matchesPaymentStatus(m: Movement, set?: Set<'paid' | 'unpaid'>) {
    if (!set || set.size === 0) return true;
    const paid = m.isPaid !== false;
    if (set.has('paid') && paid) return true;
    if (set.has('unpaid') && !paid) return true;
    return false;
}

export function filterMovementsInPeriod(
    rows: Movement[],
    period: string,
    civilYear: number,
    filter: ListFilter = {}
) {
    const { startDate, endDate } = getPeriodDateBounds(period, civilYear);
    const useDrawerDates = Boolean(filter.dateFrom || filter.dateTo);
    return rows
        .filter((m) => {
            if (m.referenceOnly) return false;
            const d = movementDate(m);
            if (Number.isNaN(d.getTime())) return false;
            if (useDrawerDates) {
                if (!movementMatchesDateRange(m, filter.dateFrom, filter.dateTo)) return false;
            } else if (d < startDate || d > endDate) return false;
            if (filter.accountId && String(m.accountId) !== filter.accountId) return false;
            if (filter.category && (m.category || '') !== filter.category) return false;
            const amt = Number(m.amount) || 0;
            if (filter.amountMin != null && Number.isFinite(filter.amountMin) && amt < filter.amountMin) return false;
            if (filter.amountMax != null && Number.isFinite(filter.amountMax) && amt > filter.amountMax) return false;
            if (!matchesSearch(m, filter.q ?? '')) return false;
            if (!matchesPaymentStatus(m, filter.paymentStatus)) return false;
            return true;
        })
        .sort((a, b) => movementDate(b).getTime() - movementDate(a).getTime());
}

export function accountName(accounts: Account[], accountId?: string) {
    if (!accountId) return '—';
    return accounts.find((a) => a.id === accountId)?.name ?? '—';
}

export function formatMovementDate(m: Movement) {
    const d = movementDate(m);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('pt-BR');
}