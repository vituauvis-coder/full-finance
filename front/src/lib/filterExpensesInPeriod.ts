import { getExpensePerInstallmentDisplayAmount } from '@motor/dinheiro/credit-installments.js';
import { expenseListDisplayDueDate, expenseMatchesListPeriod } from '@motor/dinheiro/expense-list-period.js';
import { getPeriodDateBounds, movementDate } from './period';
import type { Account, Movement } from './types/finance';
import { filterMovementsInPeriod, type ListFilter } from './movementList';

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

export function expenseListDisplayAmount(m: Movement, account?: Account) {
    return getExpensePerInstallmentDisplayAmount(m, account);
}

export function expenseRowDisplayDate(
    m: Movement,
    account: Account | undefined,
    period: string,
    civilYear: number
) {
    const { startDate, endDate } = getPeriodDateBounds(period, civilYear);
    const due = expenseListDisplayDueDate(m, account, startDate, endDate);
    if (due) return due;
    return movementDate(m);
}

/**
 * Lista de saídas: cartão entra no mês da fatura (vencimento), não no da compra.
 */
export function filterExpensesInPeriod(
    rows: Movement[],
    accounts: Account[],
    period: string,
    civilYear: number,
    filter: ListFilter = {}
) {
    const useDrawerDates = Boolean(filter.dateFrom || filter.dateTo);
    if (useDrawerDates) {
        return filterMovementsInPeriod(rows, period, civilYear, filter);
    }

    const { startDate, endDate } = getPeriodDateBounds(period, civilYear);
    const byId = new Map(accounts.map((a) => [a.id, a]));

    return rows
        .filter((m) => {
            if (m.referenceOnly) return false;
            const acc = m.accountId ? byId.get(m.accountId) : undefined;
            if (!expenseMatchesListPeriod(m, acc, startDate, endDate)) return false;
            if (filter.accountId && String(m.accountId) !== filter.accountId) return false;
            if (filter.category && (m.category || '') !== filter.category) return false;
            const amt = expenseListDisplayAmount(m, acc);
            if (filter.amountMin != null && Number.isFinite(filter.amountMin) && amt < filter.amountMin) return false;
            if (filter.amountMax != null && Number.isFinite(filter.amountMax) && amt > filter.amountMax) return false;
            if (!matchesSearch(m, filter.q ?? '')) return false;
            if (!matchesPaymentStatus(m, filter.paymentStatus)) return false;
            return true;
        })
        .sort((a, b) => movementDate(b).getTime() - movementDate(a).getTime());
}