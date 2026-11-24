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

    if (n >= 2 && (!account || !isCreditCardType(account.type))) {
        const dueDates = getLoanInstallmentDueDates(purchase, n);
        if (dueDates.some((d) => d >= start && d <= end)) return true;
    }

    return purchase >= start && purchase <= end;
}

/**
 * Limites efetivos da lista: `dateFrom`/`dateTo` do drawer sobrescrevem o período civil.
 * Sempre combinar com `expenseMatchesListPeriod` — nunca filtrar cartão só pela data da compra.
 */
export function resolveExpenseListBounds(periodStart, periodEnd, dateFrom, dateTo) {
    let start = periodStart instanceof Date ? periodStart : new Date(periodStart);
    let end = periodEnd instanceof Date ? periodEnd : new Date(periodEnd);
    if (dateFrom) {
        const from = new Date(`${dateFrom}T00:00:00`);
        if (!Number.isNaN(from.getTime())) start = from;
    }
    if (dateTo) {
        const to = new Date(`${dateTo}T23:59:59.999`);
        if (!Number.isNaN(to.getTime())) end = to;
    }
    return { start, end };
}

/**
 * Filtra saídas pelo período da lista (vencimento da fatura no cartão).
 * Aceita dateFrom/dateTo sincronizados do drawer sem cair no filtro por data da compra.
 */
export function filterExpenseRowsForListPeriod(rows, accounts, periodStart, periodEnd, opts = {}) {
    const { start, end } = resolveExpenseListBounds(
        periodStart,
        periodEnd,
        opts.dateFrom,
        opts.dateTo
    );
    const byId = new Map((accounts || []).map((a) => [a.id, a]));
    return (rows || []).filter((m) => {
        // referenceOnly (pré-âncora) continua na lista de Saídas — como no legacy.
        // Dashboard/ledger oficiais é que ignoram; aqui o usuário precisa ver jan–mar e
        // parcelas de cartão cuja compra foi antes do âncora mas o vencimento cai no mês.
        const acc = m.accountId ? byId.get(m.accountId) : undefined;
        return expenseMatchesListPeriod(m, acc, start, end);
    });
}