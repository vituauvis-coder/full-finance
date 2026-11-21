import { movementDate } from '../../../lib/period';
import type { Debt, DebtUpdate } from './debtTypes';

export function monthKey(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function enumerateCalendarYearMonths(year: number): Date[] {
    const y = Number(year) || new Date().getFullYear();
    const out: Date[] = [];
    for (let m = 0; m < 12; m++) {
        out.push(new Date(y, m, 1));
    }
    return out;
}

function activeDebts(debts: Debt[]): Debt[] {
    return debts.filter((d) => d.isClosed !== true);
}

export function latestUpdateByDebtId(updates: DebtUpdate[]): Map<string, DebtUpdate> {
    const byDebt = new Map<string, DebtUpdate>();
    for (const u of updates) {
        const debtId = String(u.debtId ?? '');
        if (!debtId) continue;
        const prev = byDebt.get(debtId);
        const t = movementDate(u).getTime();
        if (!prev || t > movementDate(prev).getTime()) {
            byDebt.set(debtId, u);
        }
    }
    return byDebt;
}

export function lastAmountInMonthByDebt(updates: DebtUpdate[], monthKeys: string[]): Map<string, DebtUpdate> {
    const byDebtMonth = new Map<string, DebtUpdate>();
    for (const u of updates) {
        const d = movementDate(u);
        const mk = monthKey(d);
        if (!monthKeys.includes(mk)) continue;
        const key = `${u.debtId}:${mk}`;
        const prev = byDebtMonth.get(key);
        const t = d.getTime();
        if (!prev || t >= movementDate(prev).getTime()) {
            byDebtMonth.set(key, u);
        }
    }
    return byDebtMonth;
}

export function updatesForDebt(updates: DebtUpdate[], debtId: string): DebtUpdate[] {
    return updates
        .filter((u) => u.debtId === debtId)
        .slice()
        .sort((a, b) => movementDate(a).getTime() - movementDate(b).getTime());
}

export function getCurrentDebtAmount(updates: DebtUpdate[], debtId: string): number | null {
    const list = updatesForDebt(updates, debtId);
    if (!list.length) return null;
    const last = list[list.length - 1];
    return Number(last.amount) || 0;
}

export function resolveInitialDebtAmount(debt: Debt, updates: DebtUpdate[]): number | null {
    const stored = debt.initialAmount;
    if (stored != null && Number.isFinite(Number(stored)) && Number(stored) >= 0) {
        return Number(stored);
    }
    const list = updatesForDebt(updates, debt.id);
    if (!list.length) return null;
    return Number(list[0].amount) || 0;
}

export type DebtChangeFromInitial =
    | { kind: 'elevated'; percent: number; delta: number }
    | { kind: 'discounted'; percent: number; delta: number }
    | { kind: 'unchanged'; percent: number; delta: number }
    | null;

export function computeDebtChangeFromInitial(initial: number | null, current: number | null): DebtChangeFromInitial {
    const init = Number(initial);
    const cur = Number(current);
    if (!Number.isFinite(init) || init <= 0 || !Number.isFinite(cur)) return null;

    const delta = cur - init;
    const pct = (delta / init) * 100;
    if (Math.abs(pct) < 0.05) {
        return { kind: 'unchanged', percent: 0, delta };
    }
    if (pct > 0) {
        return { kind: 'elevated', percent: pct, delta };
    }
    return { kind: 'discounted', percent: Math.abs(pct), delta: delta };
}

export type DebtsSummary = {
    totalToday: number;
    totalCurrentMonth: number;
    totalPrevMonth: number;
    bankCount: number;
};

export function computeDebtsSummary(debts: Debt[], updates: DebtUpdate[]): DebtsSummary {
    const active = activeDebts(debts);
    const activeIds = new Set(active.map((d) => d.id));
    const latest = latestUpdateByDebtId(updates.filter((u) => activeIds.has(String(u.debtId))));

    let totalToday = 0;
    latest.forEach((u) => {
        totalToday += Number(u.amount) || 0;
    });

    const now = new Date();
    const currentMk = monthKey(now);
    const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMk = monthKey(prevDate);

    const monthKeys = [prevMk, currentMk];
    const inMonth = lastAmountInMonthByDebt(updates, monthKeys);

    let totalCurrentMonth = 0;
    let totalPrevMonth = 0;
    for (const d of active) {
        const cur = inMonth.get(`${d.id}:${currentMk}`);
        const prev = inMonth.get(`${d.id}:${prevMk}`);
        if (cur) totalCurrentMonth += Number(cur.amount) || 0;
        if (prev) totalPrevMonth += Number(prev.amount) || 0;
    }

    const bankCount = active.filter((d) => updates.some((u) => u.debtId === d.id)).length;

    return { totalToday, totalCurrentMonth, totalPrevMonth, bankCount };
}