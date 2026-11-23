import {
    dedupeExpensesByTripExpenseId,
    preferredFinanceIdByTripExpenseFromPayload
} from '../dinheiro/dedupe-household-trip-expenses.js';

/**
 * Une expenses do payload da viagem com lançamentos Dinheiro da household.
 * Preferência: linha de `expenses` (com autor) quando há o mesmo tripExpenseId.
 *
 * @param {{
 *   payloadExpenses?: Array<{ id: string, amount?: number, description?: string }>,
 *   householdExpenses?: Array<{
 *     id: string,
 *     tripExpenseId?: string | null,
 *     amount?: number,
 *     description?: string,
 *     userId: string,
 *     authorName?: string | null
 *   }>
 * }} input
 */
function financeLedgerKind(ex) {
    const cat = String(ex?.category ?? '').trim();
    const isCofrinho = ex?.isCofrinho === true || ex?.isCofrinho === 'true';
    const paidFromCofrinho =
        ex?.paidFromCofrinho === true ||
        ex?.paidFromCofrinho === 'true' ||
        ex?.paid_from_cofrinho === true;
    if (cat === 'Cofrinhos' && isCofrinho) return 'aporte';
    if (paidFromCofrinho) return 'gasto_cofrinho';
    if (cat === 'Viagens') return 'gasto';
    if (cat === 'Cofrinhos') return 'aporte';
    return 'gasto';
}

/**
 * @param {string | Date | null | undefined} raw
 */
function financeLineDateIso(raw) {
    if (raw == null || raw === '') return null;
    const d = raw instanceof Date ? raw : new Date(raw);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 10);
}

function dedupeHouseholdTripExpenses(householdExpenses, payloadExpenses) {
    return dedupeExpensesByTripExpenseId(
        householdExpenses,
        preferredFinanceIdByTripExpenseFromPayload(payloadExpenses)
    );
}

export function mergeTripFinanceView({ payloadExpenses = [], householdExpenses = [] } = {}) {
    const household = dedupeHouseholdTripExpenses(householdExpenses, payloadExpenses);
    const covered = new Set();
    const lines = [];

    for (const ex of household) {
        const tripExpenseId = ex.tripExpenseId ?? null;
        if (tripExpenseId) covered.add(tripExpenseId);
        const ledgerKind = financeLedgerKind(ex);
        lines.push({
            id: ex.id,
            tripExpenseId,
            amount: Number(ex.amount) || 0,
            description: ex.description ?? '',
            source: 'finance',
            ledgerKind,
            category: ex.category ?? null,
            date: financeLineDateIso(ex.date),
            author: { id: ex.userId, name: ex.authorName || 'Membro' }
        });
    }

    for (const pe of payloadExpenses) {
        if (!pe?.id || covered.has(pe.id)) continue;
        lines.push({
            id: pe.id,
            tripExpenseId: pe.id,
            amount: Number(pe.amount) || 0,
            description: pe.description ?? '',
            source: 'payload',
            ledgerKind: 'gasto',
            category: null,
            date: null,
            author: null
        });
    }

    const totals = {
        amount: lines.reduce((n, l) => n + (Number(l.amount) || 0), 0),
        aportes: lines
            .filter((l) => l.ledgerKind === 'aporte')
            .reduce((n, l) => n + (Number(l.amount) || 0), 0),
        gastosCofrinho: lines
            .filter((l) => l.ledgerKind === 'gasto_cofrinho')
            .reduce((n, l) => n + (Number(l.amount) || 0), 0)
    };
    return { lines, totals };
}
