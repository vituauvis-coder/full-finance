/**
 * Um lançamento Dinheiro por linha do orçamento da viagem (`trip_id` + `trip_expense_id`).
 * Evita o mesmo gasto aparecer 2× quando mais de um membro da casa espelhou no Dinheiro.
 *
 * @param {Array<{ id?: string, tripId?: string | null, trip_expense_id?: string | null, tripExpenseId?: string | null, createdAt?: unknown }>} expenses
 * @param {Map<string, string>} [preferredFinanceIdByTripExpense] tripExpenseId → expense id preferido
 */
export function tripExpenseLineKey(ex) {
    const teId = String(ex?.tripExpenseId ?? ex?.trip_expense_id ?? '').trim();
    if (!teId) return '';
    const tripId = String(ex?.tripId ?? ex?.trip_id ?? '').trim();
    return tripId ? `${tripId}:${teId}` : teId;
}

function expenseCreatedMs(ex) {
    const c = ex?.createdAt;
    if (c == null) return 0;
    if (typeof c === 'object' && c.seconds != null) return Number(c.seconds) * 1000;
    const d = new Date(c);
    return Number.isNaN(d.getTime()) ? 0 : d.getTime();
}

function pickPreferredDuplicate(a, b, preferredFinanceIdByTripExpense, teId) {
    const pref = preferredFinanceIdByTripExpense?.get(teId);
    if (pref) {
        if (String(a.id) === pref) return a;
        if (String(b.id) === pref) return b;
    }
    const aMs = expenseCreatedMs(a);
    const bMs = expenseCreatedMs(b);
    if (aMs && bMs && aMs !== bMs) return aMs < bMs ? a : b;
    return a;
}

export function dedupeExpensesByTripExpenseId(expenses, preferredFinanceIdByTripExpense) {
    const singleton = new Map();
    const rest = [];

    for (const ex of expenses ?? []) {
        const key = tripExpenseLineKey(ex);
        if (!key) {
            rest.push(ex);
            continue;
        }
        const incumbent = singleton.get(key);
        if (!incumbent) {
            singleton.set(key, ex);
            continue;
        }
        const teId = String(ex?.tripExpenseId ?? ex?.trip_expense_id ?? '').trim();
        singleton.set(key, pickPreferredDuplicate(incumbent, ex, preferredFinanceIdByTripExpense, teId));
    }

    return [...singleton.values(), ...rest];
}

/** @param {Array<{ id: string, financeExpenseId?: string, finance_expense_id?: string }>} payloadExpenses */
export function preferredFinanceIdByTripExpenseFromPayload(payloadExpenses) {
    const map = new Map();
    for (const pe of payloadExpenses ?? []) {
        if (!pe?.id) continue;
        const fid = pe.financeExpenseId ?? pe.finance_expense_id;
        if (fid) map.set(String(pe.id), String(fid));
    }
    return map;
}

/** @param {Array<{ tripExpenseId?: string, financeExpenseId?: string }>} outflows */
export function preferredFinanceIdFromTripOutflows(outflows) {
    const map = new Map();
    for (const t of outflows ?? []) {
        const te = String(t?.tripExpenseId ?? '').trim();
        const fin = String(t?.financeExpenseId ?? '').trim();
        if (te && fin) map.set(te, fin);
    }
    return map;
}