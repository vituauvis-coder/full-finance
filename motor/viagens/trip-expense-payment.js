export const TRIP_EXPENSE_PAYMENT_METHODS = ['pix', 'credit_card'];

export function normalizePaymentMethod(raw) {
    const s = String(raw ?? 'pix').toLowerCase();
    if (s === 'credit_card' || s === 'cartao' || s === 'cartão' || s === 'card') return 'credit_card';
    return 'pix';
}

export function installmentCount(expense) {
    const n = Number(expense?.installments ?? expense?.installment_count ?? 1);
    if (!Number.isFinite(n) || n < 1) return 1;
    return Math.min(Math.floor(n), 48);
}

export function expenseAmount(expense) {
    return Math.max(0, Number(expense?.amount ?? 0) || 0);
}

/** Soma de todos os gastos (Pix + cartão) — tetos e totais da viagem. */
export function committedAmount(expense) {
    return expenseAmount(expense);
}

/** O que consome o cofrinho / caixa na meta (só Pix). */
export function tripCashCommitted(breakdown) {
    return Math.max(0, Number(breakdown?.pixPaid) || 0);
}

export function paidFromCofrinho(expense) {
    const v = expense?.paidFromCofrinho ?? expense?.paid_from_cofrinho;
    return v === true || v === 'true' || v === 1 || v === '1';
}

/** Valor do lançamento debitado do cofrinho da viagem (independente de Pix ser conta ou salário). */
export function cofrinhoSpentAmount(expense) {
    if (!paidFromCofrinho(expense)) return 0;
    return expenseAmount(expense);
}

export function sumCofrinhoSpent(expenses) {
    const list = Array.isArray(expenses) ? expenses : [];
    let total = 0;
    for (const e of list) {
        total += cofrinhoSpentAmount(e);
    }
    return total;
}

/** Valor pago / debitado na hora (PIX). */
export function paidViaPixAmount(expense) {
    return normalizePaymentMethod(expense?.paymentMethod ?? expense?.payment_method) === 'pix'
        ? expenseAmount(expense)
        : 0;
}

/** Comprometido na fatura do cartão. */
export function cardCommittedAmount(expense) {
    return normalizePaymentMethod(expense?.paymentMethod ?? expense?.payment_method) === 'credit_card'
        ? expenseAmount(expense)
        : 0;
}

/** Valor estimado de cada parcela no cartão. */
export function cardInstallmentAmount(expense) {
    if (normalizePaymentMethod(expense?.paymentMethod ?? expense?.payment_method) !== 'credit_card') return 0;
    const total = expenseAmount(expense);
    const n = installmentCount(expense);
    return n > 0 ? total / n : total;
}

export function sumPaymentBreakdown(expenses) {
    const list = Array.isArray(expenses) ? expenses : [];
    let committed = 0;
    let pixPaid = 0;
    let cardCommitted = 0;
    let cardInstallmentMonthly = 0;
    let cardSingle = 0;
    let cardInstallmentTotal = 0;
    for (const e of list) {
        committed += committedAmount(e);
        pixPaid += paidViaPixAmount(e);
        const onCard = cardCommittedAmount(e);
        cardCommitted += onCard;
        cardInstallmentMonthly += cardInstallmentAmount(e);
        if (onCard > 0) {
            const n = installmentCount(e);
            if (n >= 2) cardInstallmentTotal += onCard;
            else cardSingle += onCard;
        }
    }
    return {
        committed,
        pixPaid,
        cardCommitted,
        cardInstallmentMonthly,
        cardSingle,
        cardInstallmentTotal
    };
}

function filterExpenses(expenses, { category = null, customCategoryId = null, destinationId = null } = {}) {
    let list = Array.isArray(expenses) ? expenses : [];
    if (category) {
        list = list.filter((e) => !e.customCategoryId && !e.custom_category_id && e.category === category);
    }
    if (customCategoryId) {
        list = list.filter((e) => (e.customCategoryId ?? e.custom_category_id) === customCategoryId);
    }
    if (destinationId) {
        list = list.filter((e) => (e.destinationId ?? e.destination_id) === destinationId);
    }
    return list;
}

export function paymentBreakdown(trip, filters = {}) {
    const payload = trip?.payload ?? {};
    const expenses = filterExpenses(payload.expenses ?? [], filters);
    return sumPaymentBreakdown(expenses);
}