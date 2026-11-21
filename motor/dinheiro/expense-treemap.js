import { getExpensePerInstallmentDisplayAmount } from './credit-installments.js';

/**
 * Prepara linhas já filtradas pelo período da lista de Saídas para o mapa (treemap).
 * Inclui `referenceOnly` (pré-âncora) — mesma base dos cards e da lista; entradas é que excluem.
 * Valor = parcela do mês no cartão/empréstimo, não o total da compra.
 */
export function prepareExpenseRowsForTreemap(rows, accounts = []) {
    const byId = new Map((accounts || []).map((a) => [a.id, a]));
    const out = [];
    for (const t of rows || []) {
        if (!t) continue;
        const acc = t.accountId ? byId.get(t.accountId) : undefined;
        const amt = getExpensePerInstallmentDisplayAmount(t, acc) || Number(t.amount) || 0;
        if (amt <= 0) continue;
        out.push({ ...t, amount: amt });
    }
    return out;
}
