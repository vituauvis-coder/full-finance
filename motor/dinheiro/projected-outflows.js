import { expenseCountsAsCashOut } from './expense-cash-out.js';
import { isCreditCardType } from './account-type.js';
import { movementDateToJsDate } from './movement-date.js';
import {
    getCreditInstallmentMonthAllocationsIncludingFuture,
    getLoanInstallmentMonthAllocationsIncludingFuture
} from './credit-installments.js';
import { isLoanExpense } from './loan-expense.js';
import { applySplitNetToContribution } from './split-net.js';

export function sumOutflowsProjectedForCalendarMonth(
    mo,
    userExpenses,
    userAccounts,
    now,
    userProfile = null,
    splitRequests = null
) {
    const accountsById = new Map((userAccounts || []).map((a) => [a.id, a]));
    const mk = `${mo.start.getFullYear()}-${String(mo.start.getMonth() + 1).padStart(2, '0')}`;
    const targetMonthOrdinal = mo.start.getFullYear() * 12 + mo.start.getMonth();
    const allocCache = new Map();

    let sum = 0;
    for (const t of userExpenses || []) {
        const acc = accountsById.get(t.accountId);
        const nInst = Math.max(1, parseInt(String(t.installmentCount ?? '1'), 10) || 1);
        if (acc && isCreditCardType(acc.type)) {
            const cacheKey = t.id || `${t.accountId}|${String(t.date)}|${t.amount}|${t.description || ''}`;
            if (!allocCache.has(cacheKey)) {
                allocCache.set(
                    cacheKey,
                    getCreditInstallmentMonthAllocationsIncludingFuture(t, acc, now, userProfile)
                );
            }
            const allocs = allocCache.get(cacheKey);
            sum += applySplitNetToContribution(t, mk, allocs[mk] || 0, splitRequests, userExpenses);
        } else if (isLoanExpense(t) && (!acc || !isCreditCardType(acc.type)) && nInst >= 2) {
            const cacheKey = t.id || `loan|${t.accountId}|${String(t.date)}|${t.amount}`;
            if (!allocCache.has(cacheKey)) {
                allocCache.set(cacheKey, getLoanInstallmentMonthAllocationsIncludingFuture(t));
            }
            const allocs = allocCache.get(cacheKey);
            sum += applySplitNetToContribution(t, mk, allocs[mk] || 0, splitRequests, userExpenses);
        } else {
            const d = movementDateToJsDate(t.date);
            if (Number.isNaN(d.getTime())) continue;

            if (t.recurringMonthly === true) {
                const baseMonthOrdinal = d.getFullYear() * 12 + d.getMonth();
                if (targetMonthOrdinal >= baseMonthOrdinal && expenseCountsAsCashOut(t, acc)) {
                    sum += applySplitNetToContribution(t, mk, Number(t.amount) || 0, splitRequests, userExpenses);
                }
                continue;
            }

            if (d >= mo.start && d <= mo.end && expenseCountsAsCashOut(t, acc)) {
                sum += applySplitNetToContribution(t, mk, Number(t.amount) || 0, splitRequests, userExpenses);
            }
        }
    }
    return sum;
}