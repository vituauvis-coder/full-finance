/**
 * Contribuição de uma despesa para um mês-calendário (YYYY-MM), alinhada ao card «Saídas do mês»:
 * cartão pela parcela com vencimento naquele mês; empréstimo parcelado por vencimento; demais pela data do lançamento.
 */
import {
    creditCardCashOutForCalendarMonth,
    getCreditInstallmentMonthAllocationsIncludingFuture,
    getCreditInstallmentMonthAllocationsScheduledByDue,
    getLoanInstallmentMonthAllocationsIncludingFuture,
    isLoanExpense,
    loanInstallmentCashOutForCalendarMonth,
    shouldDeferCashOutForMonthlyFixedSeries
} from './credit-installments.js';
import { isPeriodConfirmedForDebit, parseCashOutConfirmedPeriods } from './finance-preferences.js';
import { expenseCountsAsCashOut, isCreditCardType, movementDateToJsDate } from './utils.js';
import { applySplitNetToContribution } from './split-net.js';

export function expenseContributionToCalendarMonth(
    t,
    acc,
    monthKey,
    now = new Date(),
    userProfile = null,
    splitRequests = null,
    allUserExpenses = null
) {
    if (acc && isCreditCardType(acc.type)) {
        const raw = creditCardCashOutForCalendarMonth(t, acc, monthKey, now, userProfile);
        return applySplitNetToContribution(t, monthKey, raw, splitRequests, allUserExpenses);
    }
    const n = parseInt(String(t.installmentCount ?? '1'), 10) || 1;
    if (isLoanExpense(t) && (!acc || !isCreditCardType(acc.type)) && n >= 2) {
        const raw = loanInstallmentCashOutForCalendarMonth(t, monthKey, now, userProfile);
        return applySplitNetToContribution(t, monthKey, raw, splitRequests, allUserExpenses);
    }
    const d = movementDateToJsDate(t.date);
    const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (mk !== monthKey) return 0;
    if (!expenseCountsAsCashOut(t, acc)) return 0;
    if (acc && shouldDeferCashOutForMonthlyFixedSeries(t, acc, userProfile)) {
        if (!isPeriodConfirmedForDebit(parseCashOutConfirmedPeriods(t), d)) return 0;
    }
    return applySplitNetToContribution(
        t,
        monthKey,
        Number(t.amount) || 0,
        splitRequests,
        allUserExpenses
    );
}

/** Parcelas de cartão com vencimento no mês `monthKey` (YYYY-MM), com rateio líquido — Carteira / faturas por mês civil. */
export function expenseCreditInstallmentScheduledForMonthKey(
    t,
    acc,
    monthKey,
    userProfile,
    splitRequests,
    allUserExpenses
) {
    if (!acc || !isCreditCardType(acc.type)) return 0;
    const allocs = getCreditInstallmentMonthAllocationsScheduledByDue(t, acc);
    return applySplitNetToContribution(t, monthKey, allocs[monthKey] || 0, splitRequests, allUserExpenses);
}

export function expenseContributionProjectedToMonthKey(
    t,
    acc,
    monthKey,
    now,
    userProfile = null,
    splitRequests = null,
    allUserExpenses = null
) {
    const nInst = Math.max(1, parseInt(String(t.installmentCount ?? '1'), 10) || 1);
    if (acc && isCreditCardType(acc.type)) {
        const allocs = getCreditInstallmentMonthAllocationsIncludingFuture(t, acc, now, userProfile);
        return applySplitNetToContribution(
            t,
            monthKey,
            allocs[monthKey] || 0,
            splitRequests,
            allUserExpenses
        );
    }
    if (isLoanExpense(t) && (!acc || !isCreditCardType(acc.type)) && nInst >= 2) {
        const allocs = getLoanInstallmentMonthAllocationsIncludingFuture(t);
        return applySplitNetToContribution(
            t,
            monthKey,
            allocs[monthKey] || 0,
            splitRequests,
            allUserExpenses
        );
    }
    const d = movementDateToJsDate(t.date);
    const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (mk !== monthKey) return 0;
    if (!expenseCountsAsCashOut(t, acc)) return 0;
    return applySplitNetToContribution(
        t,
        monthKey,
        Number(t.amount) || 0,
        splitRequests,
        allUserExpenses
    );
}
