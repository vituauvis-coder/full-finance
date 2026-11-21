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
export function mergeTripFinanceView({ payloadExpenses = [], householdExpenses = [] } = {}) {
    const covered = new Set();
    const lines = [];

    for (const ex of householdExpenses) {
        const tripExpenseId = ex.tripExpenseId ?? null;
        if (tripExpenseId) covered.add(tripExpenseId);
        lines.push({
            id: ex.id,
            tripExpenseId,
            amount: Number(ex.amount) || 0,
            description: ex.description ?? '',
            source: 'finance',
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
            author: null
        });
    }

    const totals = {
        amount: lines.reduce((n, l) => n + (Number(l.amount) || 0), 0)
    };
    return { lines, totals };
}
