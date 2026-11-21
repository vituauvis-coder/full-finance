import { installmentCount, normalizePaymentMethod } from './trip-expense-payment.js';

export const FINANCE_TRIP_CATEGORY = 'Viagens';

const SUBCATEGORY_BY_TRIP_CAT = {
    hospedagem: 'Hospedagem',
    comida: 'Comida',
    transporte: 'Transportes',
    passeios: 'Passeios',
    extras: 'Extras',
    documentos: 'Documentos'
};

export function tripExpenseSubcategory(tripExpense) {
    const id = tripExpense?.category ?? 'extras';
    return SUBCATEGORY_BY_TRIP_CAT[id] || String(id);
}

/**
 * Campos para espelhar TripExpense em expenses (Dinheiro). Null = não sincronizar ainda (Pix ou cartão incompleto).
 */
export function buildFinanceExpenseDraft(tripExpense, tripId) {
    const method = normalizePaymentMethod(tripExpense?.paymentMethod ?? tripExpense?.payment_method);
    if (method !== 'credit_card') return null;

    const accountId = String(tripExpense?.accountId ?? tripExpense?.account_id ?? '').trim();
    const amount = Number(tripExpense?.amount);
    if (!accountId || !Number.isFinite(amount) || amount <= 0) return null;

    const description =
        String(tripExpense?.description ?? tripExpense?.title ?? '').trim() || 'Gasto da viagem';
    const spent = String(tripExpense?.spentOn ?? '').trim().slice(0, 10);
    const date = spent || new Date().toISOString().slice(0, 10);
    const n = installmentCount(tripExpense);

    return {
        category: FINANCE_TRIP_CATEGORY,
        subcategory: tripExpenseSubcategory(tripExpense),
        accountId,
        amount,
        description,
        date,
        installmentCount: n,
        isPaid: false,
        isCofrinho: false,
        tripId,
        tripExpenseId: tripExpense.id,
        existingFinanceExpenseId:
            tripExpense?.financeExpenseId ?? tripExpense?.finance_expense_id ?? null
    };
}