import { movementDateToJsDate } from './utils.js';

export function normalizeSplitScope(raw) {
    const scope = String(raw ?? 'FULL_EXPENSE').trim().toUpperCase();
    return scope === 'INSTALLMENT' ? 'INSTALLMENT' : 'FULL_EXPENSE';
}

export function isAcceptedSettledSplitRequest(split) {
    if (!split) return false;
    const st = String(split.status ?? '').trim().toUpperCase();
    // Compatibilidade: em versões antigas não havia `isSettled`, e em algumas bases o campo pode
    // existir porém não ter sido backfilled para registros já aceitos.
    // Regra prática atual: split aceito já impacta o líquido.
    return st === 'ACCEPTED';
}

/** Estorno de split persistido (categoria Reembolsos). Usado no ledger de caixa; não excluir do card Entradas se recebido. */
export function isSplitReimbursementGain(gain) {
    if (!gain) return false;
    if (!gain.relatedExpenseId) return false;
    const cat = String(gain.category ?? '').trim().toLowerCase();
    const desc = String(gain.description ?? '').trim().toLowerCase();
    if (cat !== 'reembolsos') return false;
    // Compatibilidade: versões antigas salvaram "Extorno ..." (com X); corrigimos para "Estorno ..." (com S).
    // Também há descrições por parcela ("... parcela YYYY-MM ...").
    return (
        desc.startsWith('estorno parcial') ||
        desc.startsWith('extorno parcial') ||
        desc.startsWith('estorno parcela') ||
        desc.startsWith('extorno parcela')
    );
}

function acceptedForExpense(expenseId, splitRequests) {
    const eid = String(expenseId ?? '');
    return (splitRequests || []).filter(
        (s) => isAcceptedSettledSplitRequest(s) && String(s.sourceExpenseId ?? s.sourceExpense?.id ?? '') === eid
    );
}

export function sumAcceptedSettledFullSplitForExpense(expenseId, splitRequests) {
    return acceptedForExpense(expenseId, splitRequests)
        .filter((s) => normalizeSplitScope(s.splitScope) === 'FULL_EXPENSE')
        .reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
}

/**
 * Soma a parte FULL aceita: primeiro pelo id da saída; se zero, qualquer split FULL cuja
 * origem seja outra linha com o mesmo `recurrenceGroupId` (série de meses com o mesmo empréstimo).
 * O `amount` do pedido é a mesma metade mês a mês.
 */
export function sumAcceptedSettledFullSplitForRelatedExpense(expense, splitRequests, allUserExpenses = null) {
    const direct = sumAcceptedSettledFullSplitForExpense(expense?.id, splitRequests);
    if (direct > 0) return direct;
    if (!allUserExpenses?.length) return 0;
    const gid = expense?.recurrenceGroupId && String(expense.recurrenceGroupId).trim();
    if (!gid) return 0;
    const groupIds = new Set(
        allUserExpenses
            .filter((e) => e && String((e.recurrenceGroupId || '')) === gid)
            .map((e) => String(e.id))
    );
    if (!groupIds.size) return 0;
    let fromSeries = 0;
    for (const s of splitRequests || []) {
        if (!isAcceptedSettledSplitRequest(s) || normalizeSplitScope(s.splitScope) !== 'FULL_EXPENSE') {
            continue;
        }
        if (groupIds.has(String(s.sourceExpenseId ?? s.sourceExpense?.id ?? ''))) {
            fromSeries += Number(s.amount) || 0;
        }
    }
    return fromSeries;
}

export function sumAcceptedSettledInstallmentSplitTotalForExpense(expenseId, splitRequests) {
    return acceptedForExpense(expenseId, splitRequests)
        .filter((s) => normalizeSplitScope(s.splitScope) === 'INSTALLMENT')
        .reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
}

export function sumAcceptedSettledInstallmentSplitForExpenseMonth(
    expenseId,
    monthKey,
    splitRequests
) {
    const mk = String(monthKey ?? '');
    return acceptedForExpense(expenseId, splitRequests)
        .filter((s) => normalizeSplitScope(s.splitScope) === 'INSTALLMENT')
        .filter((s) => String(s.targetPeriodKey ?? '') === mk)
        .reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
}

export function sumAcceptedSettledInstallmentSplitThroughMonth(expenseId, monthKey, splitRequests) {
    const mk = String(monthKey ?? '');
    return acceptedForExpense(expenseId, splitRequests)
        .filter((s) => normalizeSplitScope(s.splitScope) === 'INSTALLMENT')
        .filter((s) => String(s.targetPeriodKey ?? '') <= mk)
        .reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
}

export function getNetExpenseTotalAmount(expense, splitRequests, allUserExpenses = null) {
    const total = Number(expense?.amount) || 0;
    const fullSplit = sumAcceptedSettledFullSplitForRelatedExpense(
        expense,
        splitRequests,
        allUserExpenses
    );
    const instSplit = sumAcceptedSettledInstallmentSplitTotalForExpense(expense?.id, splitRequests);
    return Math.max(0, total - fullSplit - instSplit);
}

export function applySplitNetToContribution(
    expense,
    monthKey,
    baseContribution,
    splitRequests,
    allUserExpenses = null
) {
    let value = Number(baseContribution) || 0;
    if (value <= 0) return 0;
    const grossTotal = Number(expense?.amount) || 0;
    if (grossTotal > 0) {
        const fullSplit = sumAcceptedSettledFullSplitForRelatedExpense(
            expense,
            splitRequests,
            allUserExpenses
        );
        const fullNet = Math.max(0, grossTotal - fullSplit);
        value *= fullNet / grossTotal;
    }
    value -= sumAcceptedSettledInstallmentSplitForExpenseMonth(expense?.id, monthKey, splitRequests);
    return Math.max(0, value);
}

export function movementMonthKey(dateLike) {
    const d = movementDateToJsDate(dateLike);
    if (Number.isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
