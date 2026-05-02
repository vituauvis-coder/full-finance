/**
 * Contribuição de uma despesa ao mês civil — **mesma base da lista de Saídas** e dos resumos em
 * `transactions.js` (`expenseContributionPaidThroughMonthKey`): vencimentos no mês com corte ao fim
 * do mês, incluindo parcelas de cartão **pendentes** (sem exigir «Pagar» como o painel/cards).
 */
import {
    getInstallmentDueDates,
    getLoanInstallmentDueDates,
    isLoanExpense,
    shouldDeferCashOutForMonthlyFixedSeries
} from './credit-installments.js';
import { expenseCountsAsCashOut, isCreditCardType, movementDateToJsDate } from './utils.js';
import { applySplitNetToContribution } from './split-net.js';

function endOfDay(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

function monthKeyFromDateObj(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
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

/**
 * @param {object} t despesa
 * @param {object | null | undefined} acc conta
 * @param {string} monthKey `YYYY-MM`
 * @param {Date} cutoffEndInclusive fim do período (ex.: último instante do mês)
 */
export function expenseContributionPaidThroughListMonthKey(
    t,
    acc,
    monthKey,
    cutoffEndInclusive,
    userProfile = null,
    splitRequests = null,
    allUserExpenses = null
) {
    const forSplit = allUserExpenses;
    const cutoffT = endOfDay(cutoffEndInclusive).getTime();
    const amt = Number(t.amount) || 0;
    const nInst = Math.max(1, parseInt(String(t.installmentCount ?? '1'), 10) || 1);
    const purchase = movementDateToJsDate(t.date);
    if (Number.isNaN(purchase.getTime())) return 0;

    if (acc && isCreditCardType(acc.type)) {
        const cd = coerceDayOfMonth(acc.closeDay ?? acc.closingDay);
        const dd = coerceDayOfMonth(acc.dueDay ?? acc.dueDate);
        if (!dd) {
            if (monthKeyFromDateObj(purchase) !== monthKey) return 0;
            if (purchase.getTime() > cutoffT) return 0;
            if (!expenseCountsAsCashOut(t, acc)) return 0;
            return applySplitNetToContribution(t, monthKey, amt, splitRequests, forSplit);
        }
        const dues = getInstallmentDueDates(purchase, Math.max(1, nInst), cd, dd);
        if (!dues.length) return 0;
        const per = nInst >= 2 ? amt / nInst : amt;
        let sum = 0;
        for (const due of dues) {
            if (monthKeyFromDateObj(due) !== monthKey) continue;
            if (due.getTime() > cutoffT) continue;
            sum += per;
        }
        return applySplitNetToContribution(t, monthKey, sum, splitRequests, forSplit);
    }

    if (isLoanExpense(t) && (!acc || !isCreditCardType(acc.type)) && nInst >= 2) {
        const dues = getLoanInstallmentDueDates(purchase, nInst);
        const per = amt / nInst;
        let sum = 0;
        for (const due of dues) {
            if (monthKeyFromDateObj(due) !== monthKey) continue;
            if (due.getTime() > cutoffT) continue;
            sum += per;
        }
        return applySplitNetToContribution(t, monthKey, sum, splitRequests, forSplit);
    }

    if (acc && shouldDeferCashOutForMonthlyFixedSeries(t, acc, userProfile)) {
        if (monthKeyFromDateObj(purchase) !== monthKey) return 0;
        if (purchase.getTime() > cutoffT) return 0;
        if (!expenseCountsAsCashOut(t, acc)) return 0;
        return applySplitNetToContribution(t, monthKey, amt, splitRequests, forSplit);
    }

    if (monthKeyFromDateObj(purchase) !== monthKey) return 0;
    if (purchase.getTime() > cutoffT) return 0;
    if (!expenseCountsAsCashOut(t, acc)) return 0;
    return applySplitNetToContribution(t, monthKey, amt, splitRequests, forSplit);
}
