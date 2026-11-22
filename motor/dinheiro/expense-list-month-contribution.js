import {
    getInstallmentDueDates,
    getLoanInstallmentDueDates,
    shouldDeferCashOutForMonthlyFixedSeries
} from './credit-installments.js';
import { isLoanExpense } from './loan-expense.js';
import { expenseCountsAsCashOut } from './expense-cash-out.js';
import { isCreditCardType } from './account-type.js';
import { movementDateToJsDate } from './movement-date.js';
import { applySplitNetToContribution } from './split-net.js';
import { monthKeyFromDate } from './finance-preferences.js';

function endOfDay(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

function coerceDayOfMonth(value) {
    if (value == null || value === '') return undefined;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    const s = String(value).trim();
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) {
        const day = d.getDate();
        if (day >= 1 && day <= 31) return day;
    }
    const n = parseInt(s, 10);
    if (!Number.isFinite(n) || n < 1 || n > 31) return undefined;
    return n;
}

/** Fim do mês YYYY-MM (23:59:59). */
export function endOfMonthFromMonthKey(mk) {
    const y = Number(mk.slice(0, 4));
    const m = Number(mk.slice(5, 7));
    return new Date(y, m, 0, 23, 59, 59, 999);
}

/**
 * Contribuição de uma saída ao mês civil — mesma base dos cards de Saídas
 * (vencimento da fatura no cartão, parcela do empréstimo, rateio aceito).
 */
export function expenseContributionPaidThroughListMonthKey(
    expense,
    account,
    monthKey,
    cutoffEndInclusive,
    userProfile = null,
    splitRequests = null,
    allUserExpenses = null
) {
    const forSplit = allUserExpenses;
    const cutoffT = endOfDay(cutoffEndInclusive).getTime();
    const amt = Number(expense?.amount) || 0;
    const nInst = Math.max(1, parseInt(String(expense?.installmentCount ?? '1'), 10) || 1);
    const purchase = movementDateToJsDate(expense?.date);
    if (Number.isNaN(purchase.getTime())) return 0;

    if (account && isCreditCardType(account.type)) {
        const cd = coerceDayOfMonth(account.closeDay ?? account.closingDay);
        const dd = coerceDayOfMonth(account.dueDay ?? account.dueDate);
        if (!dd) {
            if (monthKeyFromDate(purchase) !== monthKey) return 0;
            if (purchase.getTime() > cutoffT) return 0;
            if (!expenseCountsAsCashOut(expense, account)) return 0;
            return applySplitNetToContribution(expense, monthKey, amt, splitRequests, forSplit);
        }
        const dues = getInstallmentDueDates(purchase, Math.max(1, nInst), cd, dd);
        if (!dues.length) return 0;
        const per = nInst >= 2 ? amt / nInst : amt;
        let sum = 0;
        for (const due of dues) {
            if (monthKeyFromDate(due) !== monthKey) continue;
            if (due.getTime() > cutoffT) continue;
            sum += per;
        }
        return applySplitNetToContribution(expense, monthKey, sum, splitRequests, forSplit);
    }

    if (isLoanExpense(expense) && (!account || !isCreditCardType(account.type)) && nInst >= 2) {
        const dues = getLoanInstallmentDueDates(purchase, nInst);
        const per = amt / nInst;
        let sum = 0;
        for (const due of dues) {
            if (monthKeyFromDate(due) !== monthKey) continue;
            if (due.getTime() > cutoffT) continue;
            sum += per;
        }
        return applySplitNetToContribution(expense, monthKey, sum, splitRequests, forSplit);
    }

    if (account && shouldDeferCashOutForMonthlyFixedSeries(expense, account, userProfile)) {
        if (monthKeyFromDate(purchase) !== monthKey) return 0;
        if (purchase.getTime() > cutoffT) return 0;
        if (!expenseCountsAsCashOut(expense, account)) return 0;
        return applySplitNetToContribution(expense, monthKey, amt, splitRequests, forSplit);
    }

    if (monthKeyFromDate(purchase) !== monthKey) return 0;
    if (purchase.getTime() > cutoffT) return 0;
    if (!expenseCountsAsCashOut(expense, account)) return 0;
    return applySplitNetToContribution(expense, monthKey, amt, splitRequests, forSplit);
}