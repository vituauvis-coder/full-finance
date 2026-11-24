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
            const ownerRaw = ex?.userId ?? ex?.user_id ?? ex?.paidByUserId ?? ex?.paid_by_user_id;
            const ownerUserId = ownerRaw != null && String(ownerRaw).trim() ? String(ownerRaw).trim() : undefined;
            out.push({
                tripId,
                tripTitle: tripTitle || undefined,
                tripExpenseId,
                financeExpenseId,
                ownerUserId,
                amount,
                description: String(ex?.description ?? ex?.title ?? '').trim() || 'Gasto da viagem',
                spentOn: String(ex?.spentOn ?? ex?.spent_on ?? '').trim(),
                accountId: ex?.accountId ?? ex?.account_id ?? undefined
            });
        }
    }
    return out;
}

/**
 * Filtra saídas de cofrinho vindas do payload da viagem para mostrar apenas
 * as que pertencem ao `userId` logado (cada usuário tem sua própria caixinha).
 *
 * @param {ReturnType<typeof collectTripPayloadCofrinhoOutflows>} outflows
 * @param {{
 *   userId: string,
 *   mirrorRows?: Array<{ id?: string, userId?: string, tripId?: string, tripExpenseId?: string }>,
 *   tripOwnerByTripId?: Map<string, string> | Record<string, string>
 * }} ctx
 */
export function filterTripPayloadCofrinhoOutflowsForUser(
    outflows,
    { userId, mirrorRows = [], tripOwnerByTripId } = {}
) {
    const uid = String(userId ?? '').trim();
    if (!uid) return [];

    const byFinanceId = new Map();
    const byTripExpense = new Map();

    for (const r of mirrorRows ?? []) {
        const owner = String(r?.userId ?? '').trim();
        if (!owner) continue;
        const fid = String(r?.id ?? '').trim();
        if (fid) byFinanceId.set(fid, owner);
        const tid = String(r?.tripId ?? '').trim();
        const teid = String(r?.tripExpenseId ?? '').trim();
        if (tid && teid) {
            const key = `${tid}::${teid}`;
            let set = byTripExpense.get(key);
            if (!set) {
                set = new Set();
                byTripExpense.set(key, set);
            }
            set.add(owner);
        }
    }

    const tripOwnerOf = (tid) => {
        if (!tripOwnerByTripId) return '';
        if (tripOwnerByTripId instanceof Map) return String(tripOwnerByTripId.get(tid) ?? '').trim();
        return String(tripOwnerByTripId[tid] ?? '').trim();
    };

    const out = [];
    for (const row of outflows ?? []) {
        if (row.financeExpenseId && byFinanceId.has(row.financeExpenseId)) {
            if (byFinanceId.get(row.financeExpenseId) === uid) out.push(row);
            continue;
        }
        const key = `${row.tripId}::${row.tripExpenseId}`;
        if (byTripExpense.has(key)) {
            if (byTripExpense.get(key).has(uid)) out.push(row);
            continue;
        }
        if (row.ownerUserId) {
            if (row.ownerUserId === uid) out.push(row);
            continue;
        }
        const tripOwner = tripOwnerOf(row.tripId);
        if (tripOwner && tripOwner === uid) {
            out.push(row);
        }
    }
    return out;
}
