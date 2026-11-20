import { isCreditCardType } from './account-type.js';
import { getInstallmentDueDates, getLoanInstallmentDueDates } from './credit-installments.js';
import { isLoanExpense } from './loan-expense.js';
import { movementDateToJsDate } from './movement-date.js';

/** Fechamento + vencimento do cartão (fechamento padrão dia 1 se só houver vencimento). */
export function resolveCreditBillingDays(account) {
    const dueDay = account?.dueDay ?? account?.dueDate;
    let closeDay = account?.closeDay ?? account?.closingDay;
    if (dueDay == null && closeDay == null) return { closeDay: null, dueDay: null };
    if (closeDay == null) closeDay = 1;
    return { closeDay, dueDay };
}

export function creditInstallmentDueDatesForList(expense, account) {
    if (!account || !isCreditCardType(account.type)) return [];
    const { closeDay, dueDay } = resolveCreditBillingDays(account);
    if (dueDay == null) return [];
    const n = Math.max(1, parseInt(String(expense?.installmentCount ?? '1'), 10) || 1);
    const purchase = movementDateToJsDate(expense?.date);
    return getInstallmentDueDates(purchase, n, closeDay, dueDay);
}

/** Vencimento da parcela que cai no período (para coluna Data na lista de saídas). */
export function expenseListDisplayDueDate(expense, account, periodStart, periodEnd) {
    const start = periodStart instanceof Date ? periodStart : new Date(periodStart);
    const end = periodEnd instanceof Date ? periodEnd : new Date(periodEnd);
    const dueDates = creditInstallmentDueDatesForList(expense, account);
    for (const d of dueDates) {
        if (d >= start && d <= end) return d;
    }
    return null;
}

/**
 * Saída aparece no período da lista?
 * Cartão: mês do vencimento da parcela (fatura), não o da compra.
 * Demais: data do lançamento; empréstimo parcelado também por vencimento.
 */
export function expenseMatchesListPeriod(expense, account, periodStart, periodEnd) {
    const n = Math.max(1, parseInt(String(expense?.installmentCount ?? '1'), 10) || 1);
    const purchase = movementDateToJsDate(expense?.date);
    if (Number.isNaN(purchase.getTime())) return false;

    const start = periodStart instanceof Date ? periodStart : new Date(periodStart);
    const end = periodEnd instanceof Date ? periodEnd : new Date(periodEnd);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;

    if (account && isCreditCardType(account.type)) {
        const dueDates = creditInstallmentDueDatesForList(expense, account);
        if (dueDates.length > 0) {
            return dueDates.some((d) => d >= start && d <= end);
        }
        return purchase >= start && purchase <= end;
    }

    if (purchase >= start && purchase <= end) return true;

    if (!account) return false;

    if (isLoanExpense(expense) && !isCreditCardType(account.type)) {
        if (n < 2) return false;
        const dueDates = getLoanInstallmentDueDates(purchase, n);
        return dueDates.some((d) => d >= start && d <= end);
    }

    return false;
}