/**
 * Contribuição de uma despesa para um mês-calendário (YYYY-MM), alinhada ao card «Saídas do mês»:
 * cartão pela parcela com vencimento naquele mês; empréstimo parcelado por vencimento; demais pela data do lançamento.
 */
import {
    creditCardCashOutForCalendarMonth,
    isLoanExpense,
    loanInstallmentCashOutForCalendarMonth,
    shouldDeferCashOutForMonthlyFixedSeries
} from './credit-installments.js';
import { isPeriodConfirmedForDebit, parseCashOutConfirmedPeriods } from './finance-preferences.js';
import { expenseCountsAsCashOut, isCreditCardType, movementDateToJsDate } from './utils.js';

export function expenseContributionToCalendarMonth(t, acc, monthKey, now = new Date(), userProfile = null) {
    if (acc && isCreditCardType(acc.type)) {
        return creditCardCashOutForCalendarMonth(t, acc, monthKey, now, userProfile);
    }
    const n = parseInt(String(t.installmentCount ?? '1'), 10) || 1;
    if (isLoanExpense(t) && (!acc || !isCreditCardType(acc.type)) && n >= 2) {
        return loanInstallmentCashOutForCalendarMonth(t, monthKey, now, userProfile);
    }
    const d = movementDateToJsDate(t.date);
    const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (mk !== monthKey) return 0;
    if (!expenseCountsAsCashOut(t, acc)) return 0;
    if (acc && shouldDeferCashOutForMonthlyFixedSeries(t, acc, userProfile)) {
        if (!isPeriodConfirmedForDebit(parseCashOutConfirmedPeriods(t), d)) return 0;
    }
    return Number(t.amount) || 0;
}
