import { getExpensePerInstallmentDisplayAmount } from '@motor/dinheiro/credit-installments.js';
import {
    expenseListDisplayDueDate,
    filterExpenseRowsForListPeriod
} from '@motor/dinheiro/expense-list-period.js';
import { getPeriodDateBounds, isAllYearsPeriod, movementDate } from './period';
import type { Account, Movement } from './types/finance';
import type { ListFilter } from './movementList';
import { expandAccountFilterIds } from './movementListAccountFilter';

const ALL_YEARS_LIST_START = new Date(1900, 0, 1, 0, 0, 0, 0);
const ALL_YEARS_LIST_END = new Date(2099, 11, 31, 23, 59, 59, 999);

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

/** Filtros do drawer / busca / status — sem recorte de período civil. */
export function filterExpensesByListFilter(rows: Movement[], accounts: Account[], filter: ListFilter = {}) {
    const byId = new Map(accounts.map((a) => [a.id, a]));
    const accountFilterIds = filter.accountId ? expandAccountFilterIds(filter.accountId, accounts) : null;
    return (rows || []).filter((m) => {
        const acc = m.accountId ? byId.get(m.accountId) : undefined;
        if (accountFilterIds && !accountFilterIds.has(String(m.accountId ?? ''))) return false;
        if (filter.category && (m.category || '') !== filter.category) return false;
        const amt = expenseListDisplayAmount(m, acc);
        if (filter.amountMin != null && Number.isFinite(filter.amountMin) && amt < filter.amountMin) return false;
        if (filter.amountMax != null && Number.isFinite(filter.amountMax) && amt > filter.amountMax)
            return false;
        if (!matchesSearch(m, filter.q ?? '')) return false;
        if (!matchesPaymentStatus(m, filter.paymentStatus)) return false;
        return true;
    });
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
    const { startDate, endDate } = isAllYearsPeriod(period)
        ? { startDate: ALL_YEARS_LIST_START, endDate: ALL_YEARS_LIST_END }
        : getPeriodDateBounds(period, civilYear);
    const due = expenseListDisplayDueDate(m, account, startDate, endDate);
    if (due) return due;
    return movementDate(m);
}

/**
 * Lista de saídas: cartão entra no mês da fatura (vencimento), não no da compra.
 * dateFrom/dateTo do drawer (mesmo sincronizados ao mês) NÃO mudam essa regra.
 */
export function filterExpensesInPeriod(
    rows: Movement[],
    accounts: Account[],
    period: string,
    civilYear: number,
    filter: ListFilter = {}
) {
    const allYears = isAllYearsPeriod(period);
    const { startDate, endDate } = allYears
        ? { startDate: ALL_YEARS_LIST_START, endDate: ALL_YEARS_LIST_END }
        : getPeriodDateBounds(period, civilYear);
    const byId = new Map(accounts.map((a) => [a.id, a]));
    const accountFilterIds = filter.accountId ? expandAccountFilterIds(filter.accountId, accounts) : null;
    const useDrawerDates = Boolean(filter.dateFrom || filter.dateTo);

    const periodScoped = allYears && !useDrawerDates
        ? rows
        : filterExpenseRowsForListPeriod(rows, accounts, startDate, endDate, {
              dateFrom: filter.dateFrom,
              dateTo: filter.dateTo
          });

    return periodScoped
        .filter((m) => {
            const acc = m.accountId ? byId.get(m.accountId) : undefined;
            if (accountFilterIds && !accountFilterIds.has(String(m.accountId ?? ''))) return false;
            if (filter.category && (m.category || '') !== filter.category) return false;
            const amt = expenseListDisplayAmount(m, acc);
            if (filter.amountMin != null && Number.isFinite(filter.amountMin) && amt < filter.amountMin)
                return false;
            if (filter.amountMax != null && Number.isFinite(filter.amountMax) && amt > filter.amountMax)
                return false;
            if (!matchesSearch(m, filter.q ?? '')) return false;
            if (!matchesPaymentStatus(m, filter.paymentStatus)) return false;
            return true;
        })
        .sort((a, b) => movementDate(b).getTime() - movementDate(a).getTime());
}
