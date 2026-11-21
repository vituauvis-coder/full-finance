import { normalizeSplitScope } from '@motor/dinheiro/split-net.js';
import type { ExpenseSplitRequest, Movement } from '../../../lib/types/finance';

export function splitStatusLabel(st: unknown) {
    const u = String(st ?? '').toUpperCase();
    if (u === 'PENDING') return 'Pendente';
    if (u === 'ACCEPTED') return 'Aceita';
    if (u === 'REJECTED') return 'Recusada';
    if (u === 'CANCELLED') return 'Cancelada';
    return u || '—';
}

export function splitStatusClass(st: unknown) {
    const u = String(st ?? '').toUpperCase();
    if (u === 'PENDING') return 'expense-split-status--pending';
    if (u === 'ACCEPTED') return 'expense-split-status--accepted';
    if (u === 'REJECTED') return 'expense-split-status--rejected';
    if (u === 'CANCELLED') return 'expense-split-status--cancelled';
    return '';
}

export function splitScopeLabel(scope: unknown) {
    return normalizeSplitScope(scope) === 'INSTALLMENT' ? 'Parcela' : 'Lançamento';
}

export function monthKeyFromExpenseDate(expense: Movement, installmentIndex: number) {
    const raw = expense.date;
    let d: Date;
    if (raw != null && typeof raw === 'object' && raw.seconds != null) {
        d = new Date(raw.seconds * 1000);
    } else {
        d = new Date(raw as string);
    }
    if (Number.isNaN(d.getTime())) d = new Date();
    d.setMonth(d.getMonth() + Math.max(0, installmentIndex - 1));
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
}

export function sumAllocatedSplitForTarget(
    outgoing: ExpenseSplitRequest[] | undefined,
    expenseId: string,
    splitScope: string,
    targetInstallmentIndex: number | null = null
) {
    const eid = String(expenseId ?? '');
    const scope = normalizeSplitScope(splitScope);
    return (outgoing || [])
        .filter((s) => String(s.sourceExpenseId ?? s.sourceExpense?.id ?? '') === eid)
        .filter((s) => ['PENDING', 'ACCEPTED'].includes(String(s.status ?? '').toUpperCase()))
        .filter((s) => normalizeSplitScope(s.splitScope) === scope)
        .filter((s) =>
            scope === 'INSTALLMENT'
                ? Number(s.targetInstallmentIndex || 0) === Number(targetInstallmentIndex || 0)
                : true
        )
        .reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
}

export function computeSplitMoneyContext(
    expense: Movement,
    outgoing: ExpenseSplitRequest[] | undefined,
    scopeRaw: string,
    installmentIndex: number | null
) {
    const scope = normalizeSplitScope(scopeRaw);
    const total = Number(expense.amount) || 0;
    const n = Math.max(1, parseInt(String(expense.installmentCount ?? '1'), 10) || 1);
    const per = n >= 2 ? total / n : total;
    const targetMax = scope === 'INSTALLMENT' ? per : total;
    const instIdx = scope === 'INSTALLMENT' ? installmentIndex : null;
    const allocated =
        scope === 'INSTALLMENT' && (instIdx == null || !Number.isFinite(instIdx))
            ? 0
            : sumAllocatedSplitForTarget(outgoing, expense.id, scope, instIdx);
    const remaining = Math.max(0.01, targetMax - allocated);
    return { scope, n, total, per, targetMax, allocated, remaining, installmentIndex: instIdx };
}

export function outgoingForExpense(outgoing: ExpenseSplitRequest[] | undefined, expenseId: string) {
    return (outgoing || [])
        .filter((s) => String(s.sourceExpenseId ?? s.sourceExpense?.id ?? '') === String(expenseId))
        .sort((a, b) => {
            const ta = new Date(a.createdAt ?? 0).getTime();
            const tb = new Date(b.createdAt ?? 0).getTime();
            return tb - ta;
        });
}
