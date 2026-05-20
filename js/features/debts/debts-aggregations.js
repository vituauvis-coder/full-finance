import { movementDateToJsDate } from '../../core/utils.js';

export function monthKey(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function enumerateMonths(minDate, maxDate) {
    const start = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
    const end = new Date(maxDate.getFullYear(), maxDate.getMonth(), 1);
    const out = [];
    let y = start.getFullYear();
    let m = start.getMonth();
    while (y < end.getFullYear() || (y === end.getFullYear() && m <= end.getMonth())) {
        out.push(new Date(y, m, 1));
        m++;
        if (m > 11) {
            m = 0;
            y++;
        }
    }
    return out;
}

/** Janeiro a dezembro de um ano civil. */
export function enumerateCalendarYearMonths(year) {
    const y = Number(year) || new Date().getFullYear();
    const out = [];
    for (let m = 0; m < 12; m++) {
        out.push(new Date(y, m, 1));
    }
    return out;
}

function activeDebts(debts) {
    return (debts || []).filter((d) => d.isClosed !== true);
}

/** Último update por debtId (qualquer mês). */
export function latestUpdateByDebtId(updates) {
    const byDebt = new Map();
    (updates || []).forEach((u) => {
        const prev = byDebt.get(u.debtId);
        const t = movementDateToJsDate(u.date).getTime();
        if (!prev || t > movementDateToJsDate(prev.date).getTime()) {
            byDebt.set(u.debtId, u);
        }
    });
    return byDebt;
}

/** Último valor registrado no mês M por debtId. */
export function lastAmountInMonthByDebt(updates, monthKeys) {
    const byDebtMonth = new Map();
    (updates || []).forEach((u) => {
        const d = movementDateToJsDate(u.date);
        const mk = monthKey(d);
        if (!monthKeys.includes(mk)) return;
        const key = `${u.debtId}:${mk}`;
        const prev = byDebtMonth.get(key);
        const t = d.getTime();
        if (!prev || t >= movementDateToJsDate(prev.date).getTime()) {
            byDebtMonth.set(key, u);
        }
    });
    return byDebtMonth;
}

/** Updates de uma dívida, do mais antigo ao mais recente. */
export function updatesForDebt(updates, debtId) {
    return (updates || [])
        .filter((u) => u.debtId === debtId)
        .slice()
        .sort((a, b) => movementDateToJsDate(a.date) - movementDateToJsDate(b.date));
}

export function getCurrentDebtAmount(updates, debtId) {
    const list = updatesForDebt(updates, debtId);
    if (!list.length) return null;
    const last = list[list.length - 1];
    return Number(last.amount) || 0;
}

export function resolveInitialDebtAmount(debt, updates) {
    const stored = debt?.initialAmount;
    if (stored != null && Number.isFinite(Number(stored)) && Number(stored) >= 0) {
        return Number(stored);
    }
    const list = updatesForDebt(updates, debt?.id);
    if (!list.length) return null;
    return Number(list[0].amount) || 0;
}

/**
 * Variação do saldo atual em relação ao inicial (uma métrica só: elevado OU desconto).
 * @returns {{ kind: 'elevated'|'discounted'|'unchanged', percent: number, delta: number }|null}
 */
export function computeDebtChangeFromInitial(initial, current) {
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
    return { kind: 'discounted', percent: Math.abs(pct), delta };
}

export function computeDebtsSummary(debts, updates) {
    const active = activeDebts(debts);
    const activeIds = new Set(active.map((d) => d.id));
    const latest = latestUpdateByDebtId((updates || []).filter((u) => activeIds.has(u.debtId)));

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
    active.forEach((d) => {
        const cur = inMonth.get(`${d.id}:${currentMk}`);
        const prev = inMonth.get(`${d.id}:${prevMk}`);
        if (cur) totalCurrentMonth += Number(cur.amount) || 0;
        if (prev) totalPrevMonth += Number(prev.amount) || 0;
    });

    const bankCount = active.filter((d) => (updates || []).some((u) => u.debtId === d.id)).length;

    return {
        totalToday,
        totalCurrentMonth,
        totalPrevMonth,
        bankCount
    };
}
