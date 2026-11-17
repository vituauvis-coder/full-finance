import { movementDateToJsDate } from '../../core/utils.js';
import { monthKey, enumerateMonths } from './debts-aggregations.js';

export const DEBT_FORM_MONTH_CAP = 120;

/** Opções do seletor de mês de início (valor MM, rótulo). */
export const DEBT_START_MONTH_OPTIONS = [
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

export function formatDebtMonthShortLabel(d) {
    const month = d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
    const yy = String(d.getFullYear() % 100).padStart(2, '0');
    return `${month}/${yy}`;
}

export function buildMonthsForDebtForm(startDateStr) {
    if (!startDateStr || String(startDateStr).trim() === '') {
        return { months: [], truncated: false, note: '' };
    }
    const parts = String(startDateStr).split('-').map(Number);
    if (parts.length < 2 || Number.isNaN(parts[0]) || Number.isNaN(parts[1])) {
        return { months: [], truncated: false, note: '' };
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

/** @returns {{ year: number, months: Date[] }[]} ordem cronológica */
export function groupMonthsByYear(months) {
    const byYear = new Map();
    (months || []).forEach((d) => {
        const y = d.getFullYear();
        if (!byYear.has(y)) byYear.set(y, []);
        byYear.get(y).push(d);
    });
    return [...byYear.entries()]
        .sort(([a], [b]) => a - b)
        .map(([year, list]) => ({ year, months: list }));
}

/** Último update por monthKey para um debtId (desempate por data mais recente). */
export function indexUpdatesByMonthKey(updates, debtId) {
    const map = new Map();
    (updates || [])
        .filter((u) => u.debtId === debtId)
        .forEach((u) => {
            const mk = monthKey(movementDateToJsDate(u.date));
            const prev = map.get(mk);
            if (!prev || movementDateToJsDate(u.date) >= movementDateToJsDate(prev.date)) {
                map.set(mk, u);
            }
        });
    return map;
}

/** Valor do mês anterior preenchido no mapa, percorrendo monthKeys em ordem. */
export function previousFilledAmount(monthKeys, valuesMap, currentKey) {
    const idx = monthKeys.indexOf(currentKey);
    if (idx <= 0) return null;
    for (let i = idx - 1; i >= 0; i--) {
        const v = valuesMap.get(monthKeys[i]);
        if (v != null && String(v).trim() !== '') return v;
    }
    return null;
}

export function countFilledMonths(valuesMap) {
    let n = 0;
    valuesMap.forEach((v) => {
        if (v != null && String(v).trim() !== '') n++;
    });
    return n;
}
