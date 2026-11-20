import { cardInstallmentAmount, installmentCount, normalizePaymentMethod } from './trip-expense-payment.js';

function expenseTitle(ex) {
    const t = ex.description ?? ex.title ?? '';
    return String(t).trim() || 'Lançamento';
}

function sortItems(items) {
    return [...items].sort((a, b) => String(b.spentOn ?? '').localeCompare(String(a.spentOn ?? '')));
}

/**
 * Itens que compõem o gasto de uma categoria (lançamentos + hospedagem/voos na ficha).
 * @returns {Array<{ id: string, kind: string, title: string, amount: number, spentOn?: string, source: string, paymentMethod?: string, installments?: number, installmentAmount?: number, destinationId?: string | null }>}
 */
export function categoryLedgerItems(trip, { category = null, customCategoryId = null } = {}) {
    const payload = trip?.payload ?? {};
    const items = [];

    for (const ex of payload.expenses ?? []) {
        if (customCategoryId) {
            const cid = ex.customCategoryId ?? ex.custom_category_id;
            if (cid !== customCategoryId) continue;
        } else if (category) {
            if (ex.customCategoryId ?? ex.custom_category_id) continue;
            if (ex.category !== category) continue;
        } else continue;

        const method = normalizePaymentMethod(ex.paymentMethod ?? ex.payment_method);
        const installments = installmentCount(ex);
        items.push({
            id: String(ex.id),
            kind: 'expense',
            title: expenseTitle(ex),
            amount: Math.max(0, Number(ex.amount ?? 0) || 0),
            spentOn: ex.spentOn ?? ex.spent_on ?? ex.date,
            source: 'lançamento',
            paymentMethod: method,
            installments,
            installmentAmount: method === 'credit_card' ? cardInstallmentAmount(ex) : 0,
            destinationId: ex.destinationId ?? ex.destination_id ?? null
        });
    }

    if (!customCategoryId && category === 'hospedagem') {
        for (const stay of payload.stays ?? []) {
            const amount = Math.max(0, Number(stay.amount ?? 0) || 0);
            if (amount <= 0 && !(stay.name ?? '').trim()) continue;
            items.push({
                id: String(stay.id),
                kind: 'stay',
                title: (stay.name ?? '').trim() || 'Hospedagem',
                amount,
                spentOn: stay.checkInOn ?? stay.check_in_on,
                source: 'ficha · hospedagem',
                destinationId: stay.destinationId ?? stay.destination_id ?? null
            });
        }
    }

    if (!customCategoryId && category === 'transporte') {
        for (const leg of payload.legs ?? []) {
            const dest = leg.tripDestinationId ?? leg.trip_destination_id;
            if (!dest) continue;
            const from = leg.fromName ?? leg.from_name ?? '';
            const to = leg.toName ?? leg.to_name ?? '';
            const title = [from, to].filter(Boolean).join(' → ') || 'Trecho';
            const amount = Math.max(0, Number(leg.amount ?? 0) || 0);
            items.push({
                id: String(leg.id),
                kind: 'leg',
                title,
                amount,
                spentOn: leg.departedOn ?? leg.departed_on,
                source: 'ficha · voo',
                destinationId: dest
            });
        }
    }

    return sortItems(items);
}