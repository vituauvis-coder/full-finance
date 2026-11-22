import {
    installmentCount,
    normalizePaymentMethod,
    paidFromCofrinho as expensePaidFromCofrinho
} from './trip-expense-payment.js';

export const FINANCE_TRIP_CATEGORY = 'Viagens';

const SUBCATEGORY_BY_TRIP_CAT = {
    hospedagem: 'Hospedagem',
    comida: 'Comida',
    transporte: 'Transportes',
    passeios: 'Passeios',
    extras: 'Extras',
    documentos: 'Documentos'
};

/** Rótulo interno do orçamento da ficha (hospedagem, documentos…). */
export function tripExpenseSubcategory(tripExpense) {
    const id = tripExpense?.category ?? 'extras';
    return SUBCATEGORY_BY_TRIP_CAT[id] || String(id);
}

/**
 * Subcategoria no Dinheiro = nome da viagem (mesmo valor para qualquer membro da casa).
 */
export function financeTripSubcategory(tripTitle) {
    const name = String(tripTitle ?? '').trim();
    return name || 'Viagem';
}

/**
 * Campos para espelhar TripExpense em expenses (Dinheiro).
 * Null = incompleto (sem conta/valor) — não sincronizar ainda.
 * - category: sempre "Viagens"
 * - subcategory: nome da viagem
 * - credit_card → cartão (parcelas, isPaid false)
 * - pix (à vista) → conta corrente/poupança (isPaid true)
 * - pix pago do cofrinho da viagem → espelha como `Viagens` + `paidFromCofrinho` (tipo C; não debita conta)
 *
 * @param {object} tripExpense
 * @param {string} tripId
 * @param {{ tripTitle?: string }} [opts]
 */
export function buildFinanceExpenseDraft(tripExpense, tripId, opts = {}) {
    const method = normalizePaymentMethod(tripExpense?.paymentMethod ?? tripExpense?.payment_method);
    if (method !== 'credit_card' && method !== 'pix') return null;

    const accountId = String(tripExpense?.accountId ?? tripExpense?.account_id ?? '').trim();
    const amount = Number(tripExpense?.amount);
    const fromCofrinho = expensePaidFromCofrinho(tripExpense);
    if (!Number.isFinite(amount) || amount <= 0) return null;
    if (!fromCofrinho && !accountId) return null;

    const description =
        String(tripExpense?.description ?? tripExpense?.title ?? '').trim() || 'Gasto da viagem';
    const spent = String(tripExpense?.spentOn ?? '').trim().slice(0, 10);
    const date = spent || new Date().toISOString().slice(0, 10);
    const isPix = method === 'pix';
    const n = isPix ? 1 : installmentCount(tripExpense);

    return {
        category: FINANCE_TRIP_CATEGORY,
        subcategory: financeTripSubcategory(opts.tripTitle),
        accountId: accountId || null,
        amount,
        description,
        date,
        installmentCount: n,
        isPaid: fromCofrinho ? true : isPix,
        isCofrinho: false,
        paidFromCofrinho: fromCofrinho,
        tripId,
        tripExpenseId: tripExpense.id,
        existingFinanceExpenseId:
            tripExpense?.financeExpenseId ?? tripExpense?.finance_expense_id ?? null
    };
}
