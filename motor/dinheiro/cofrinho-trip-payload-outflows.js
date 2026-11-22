import { paidFromCofrinho } from '../viagens/trip-expense-payment.js';

/**
 * Gastos marcados “Debitar da meta” no orçamento da viagem (payload),
 * inclusive quando o espelho em `expenses` ainda não existe ou está desatualizado.
 *
 * @param {Array<{ id?: string, tripId?: string, title?: string, payload?: { expenses?: object[] } }>} trips
 */
export function collectTripPayloadCofrinhoOutflows(trips) {
    const out = [];
    for (const trip of trips ?? []) {
        const tripId = String(trip?.id ?? trip?.tripId ?? '').trim();
        if (!tripId) continue;
        const tripTitle = String(trip?.title ?? '').trim();
        const payload = trip?.payload && typeof trip.payload === 'object' ? trip.payload : {};
        const expenses = Array.isArray(payload.expenses) ? payload.expenses : [];
        for (const ex of expenses) {
            if (!paidFromCofrinho(ex)) continue;
            if (ex?.isPaid === false) continue;
            const amount = Number(ex?.amount);
            if (!Number.isFinite(amount) || amount <= 0) continue;
            const tripExpenseId = String(ex?.id ?? '').trim();
            if (!tripExpenseId) continue;
            const finRaw = ex?.financeExpenseId ?? ex?.finance_expense_id;
            const financeExpenseId = finRaw != null && String(finRaw).trim() ? String(finRaw).trim() : undefined;
            out.push({
                tripId,
                tripTitle: tripTitle || undefined,
                tripExpenseId,
                financeExpenseId,
                amount,
                description: String(ex?.description ?? ex?.title ?? '').trim() || 'Gasto da viagem',
                spentOn: String(ex?.spentOn ?? ex?.spent_on ?? '').trim(),
                accountId: ex?.accountId ?? ex?.account_id ?? undefined
            });
        }
    }
    return out;
}