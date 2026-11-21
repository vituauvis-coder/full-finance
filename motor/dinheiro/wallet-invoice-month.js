import { expenseCreditInstallmentScheduledForMonthKey } from '../../legacy-web/js/core/expense-calendar-month.js';

/**
 * Soma parcelas de crédito com vencimento no mês civil (monthIndex 0–11).
 * @param {object} card
 * @param {object[]} expenses
 * @param {number} year
 * @param {number} monthIndex0
 * @param {object|null} userProfile
 * @param {unknown[]} acceptedSplits
 * @param {object[]} [allExpenses]
 */
export function creditCardInstallmentsDueInCalendarMonth(
    card,
    expenses,
    year,
    monthIndex0,
    userProfile = null,
    acceptedSplits = [],
    allExpenses = null
) {
    const y = Number(year);
    const mi = Number(monthIndex0);
    if (!Number.isFinite(y) || !Number.isFinite(mi) || mi < 0 || mi > 11) return 0;
    const monthKey = `${y}-${String(mi + 1).padStart(2, '0')}`;
    const list = allExpenses != null ? allExpenses : expenses || [];
    let sum = 0;
    for (const t of expenses || []) {
        if (t.accountId !== card.id) continue;
        sum += expenseCreditInstallmentScheduledForMonthKey(t, card, monthKey, userProfile, acceptedSplits, list);
    }
    return sum;
}

/**
 * @param {object[]} creditCards
 * @param {object[]} expenses
 * @param {number} year
 * @param {number} monthIndex0
 */
export function totalCreditInvoicesForMonth(
    creditCards,
    expenses,
    year,
    monthIndex0,
    userProfile = null,
    acceptedSplits = [],
    allExpenses = null
) {
    let total = 0;
    for (const c of creditCards) {
        total += creditCardInstallmentsDueInCalendarMonth(
            c,
            expenses,
            year,
            monthIndex0,
            userProfile,
            acceptedSplits,
            allExpenses
        );
    }
    return total;
}