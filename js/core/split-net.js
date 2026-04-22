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

export function isSplitReimbursementGain(gain) {
    if (!gain) return false;
    if (!gain.relatedExpenseId) return false;
    const cat = String(gain.category ?? '').trim().toLowerCase();
    const desc = String(gain.description ?? '').trim().toLowerCase();
    return cat === 'reembolsos' && desc.startsWith('extorno parcial');
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

export function getNetExpenseTotalAmount(expense, splitRequests) {
    const total = Number(expense?.amount) || 0;
    const fullSplit = sumAcceptedSettledFullSplitForExpense(expense?.id, splitRequests);
    const instSplit = sumAcceptedSettledInstallmentSplitTotalForExpense(expense?.id, splitRequests);
    return Math.max(0, total - fullSplit - instSplit);
}

export function applySplitNetToContribution(expense, monthKey, baseContribution, splitRequests) {
    let value = Number(baseContribution) || 0;
    if (value <= 0) return 0;
    const grossTotal = Number(expense?.amount) || 0;
    if (grossTotal > 0) {
        const fullSplit = sumAcceptedSettledFullSplitForExpense(expense?.id, splitRequests);
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
