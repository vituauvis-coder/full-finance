import { movementDate } from '../../../lib/period';
import { monthKey, updatesForDebt } from './debtAggregations';
import type { DebtUpdate } from './debtTypes';

export const DEBT_QUITACAO_LABEL = 'Quitação';

export function isQuitacaoUpdate(u: DebtUpdate): boolean {
    return String(u.description ?? '').trim().toLowerCase() === DEBT_QUITACAO_LABEL.toLowerCase();
}

/** Último mês (cronológico) com saldo &gt; 0 registrado. */
export function lastMonthKeyWithPositiveBalance(updates: DebtUpdate[], debtId: string): string | null {
    let best: { mk: string; t: number } | null = null;
    for (const u of updatesForDebt(updates, debtId)) {
        const amt = Number(u.amount);
        if (!Number.isFinite(amt) || amt <= 0) continue;
        if (isQuitacaoUpdate(u)) continue;
        const d = movementDate(u);
        const t = d.getTime();
        const mk = monthKey(d);
        if (!best || t >= best.t) best = { mk, t };
    }
    return best?.mk ?? null;
}

export function monthKeyAddMonths(mk: string, addMonths: number): string {
    const [y, m] = mk.split('-').map(Number);
    const d = new Date(y, (m || 1) - 1 + addMonths, 1, 12, 0, 0);
    return monthKey(d);
}

export function monthKeyToReferenceDate(mk: string): Date {
    const [y, m] = mk.split('-').map(Number);
    if (!y || !m) return new Date();
    return new Date(y, m - 1, 1, 12, 0, 0);
}

/** Mês da atualização «Quitação», ou mês seguinte ao último saldo positivo. */
export function resolveQuitacaoMonthKey(updates: DebtUpdate[], debtId: string): string | null {
    const list = updatesForDebt(updates, debtId);
    for (let i = list.length - 1; i >= 0; i--) {
        const u = list[i];
        if (isQuitacaoUpdate(u)) return monthKey(movementDate(u));
    }
    const lastBal = lastMonthKeyWithPositiveBalance(updates, debtId);
    if (lastBal) return monthKeyAddMonths(lastBal, 1);
    return null;
}

/** Mês onde deve existir o lançamento 0 ao marcar quitada. */
export function plannedQuitacaoMonthKey(updates: DebtUpdate[], debtId: string): string {
    const resolved = resolveQuitacaoMonthKey(updates, debtId);
    if (resolved) return resolved;
    const lastBal = lastMonthKeyWithPositiveBalance(updates, debtId);
    if (lastBal) return monthKeyAddMonths(lastBal, 1);
    return monthKey(new Date());
}