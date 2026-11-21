import { movementDate } from '../../../lib/period';
import type { DebtUpdate } from './debtTypes';
import { monthKey } from './debtAggregations';

export const DEBT_FORM_MONTH_CAP = 120;

export const DEBT_START_MONTH_OPTIONS: [string, string][] = [
    ['01', 'Janeiro'],
    ['02', 'Fevereiro'],
    ['03', 'Março'],
    ['04', 'Abril'],
    ['05', 'Maio'],
    ['06', 'Junho'],
    ['07', 'Julho'],
    ['08', 'Agosto'],
    ['09', 'Setembro'],
    ['10', 'Outubro'],
    ['11', 'Novembro'],
    ['12', 'Dezembro']
];

export function debtStartYearRange() {
    const current = new Date().getFullYear();
    return { min: current - 35, max: current + 1 };
}

export function enumerateMonths(minDate: Date, maxDate: Date): Date[] {
    const start = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
    const end = new Date(maxDate.getFullYear(), maxDate.getMonth(), 1);
    const out: Date[] = [];
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

export function formatDebtMonthShortLabel(d: Date): string {
    const month = d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
    const yy = String(d.getFullYear() % 100).padStart(2, '0');
    return `${month}/${yy}`;
}

export function buildMonthsForDebtForm(startDateStr: string) {
    if (!startDateStr || String(startDateStr).trim() === '') {
        return { months: [] as Date[], note: '' };
    }
    const parts = String(startDateStr).split('-').map(Number);
    if (parts.length < 2 || Number.isNaN(parts[0]) || Number.isNaN(parts[1])) {
        return { months: [] as Date[], note: '' };
    }
    const start = new Date(parts[0], parts[1] - 1, 1);
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const from = start;
    const to =
        start.getTime() > currentMonthStart.getTime()
            ? new Date(start.getFullYear(), start.getMonth() + 11, 1)
            : currentMonthStart;
    let months = enumerateMonths(from, to);
    let note = '';
    if (months.length > DEBT_FORM_MONTH_CAP) {
        note = `São ${months.length} meses neste intervalo. Mostrando os últimos ${DEBT_FORM_MONTH_CAP} meses (até o mês atual). Para meses mais antigos, ajuste a data de início.`;
        months = months.slice(-DEBT_FORM_MONTH_CAP);
    }
    return { months, note };
}

export function groupMonthsByYear(months: Date[]) {
    const byYear = new Map<number, Date[]>();
    (months || []).forEach((d) => {
        const y = d.getFullYear();
        if (!byYear.has(y)) byYear.set(y, []);
        byYear.get(y)!.push(d);
    });
    return [...byYear.entries()]
        .sort(([a], [b]) => a - b)
        .map(([year, list]) => ({ year, months: list }));
}

export function indexUpdatesByMonthKey(updates: DebtUpdate[], debtId: string) {
    const map = new Map<string, DebtUpdate & { id: string }>();
    (updates || [])
        .filter((u) => u.debtId === debtId && u.id)
        .forEach((u) => {
            const mk = monthKey(movementDate(u));
            const prev = map.get(mk);
            if (!prev || movementDate(u).getTime() >= movementDate(prev).getTime()) {
                map.set(mk, u as DebtUpdate & { id: string });
            }
        });
    return map;
}

export function previousFilledAmount(monthKeys: string[], values: Record<string, string>, currentKey: string) {
    const idx = monthKeys.indexOf(currentKey);
    if (idx <= 0) return null;
    for (let i = idx - 1; i >= 0; i--) {
        const v = values[monthKeys[i]];
        if (v != null && String(v).trim() !== '') return v;
    }
    return null;
}

export function countFilledMonths(values: Record<string, string>) {
    let n = 0;
    Object.values(values).forEach((v) => {
        if (v != null && String(v).trim() !== '') n++;
    });
    return n;
}

export function monthKeyToReferenceDate(key: string): Date {
    const [y, m] = key.split('-').map(Number);
    if (!y || !m) return new Date();
    return new Date(y, m - 1, 1, 12, 0, 0);
}

export function parseStartDateValue(startMonth: string, startYear: string): string {
    if (!startMonth || !startYear) return '';
    return `${startYear}-${startMonth}`;
}