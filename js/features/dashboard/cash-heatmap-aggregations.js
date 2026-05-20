import { getPeriodDateBounds } from '../../core/period-filters.js';
import { isCreditCardType, movementDateToJsDate } from '../../core/utils.js';

const MONTH_NAMES_PT = [
    'Janeiro',
    'Fevereiro',
    'Março',
    'Abril',
    'Maio',
    'Junho',
    'Julho',
    'Agosto',
    'Setembro',
    'Outubro',
    'Novembro',
    'Dezembro'
];

export function formatHeatmapMonthLabel(year, monthIndex) {
    return `${MONTH_NAMES_PT[monthIndex]} ${year}`;
}

/** Resolve { year, monthIndex } (0–11) a partir do #period-filter. */
export function resolveHeatmapMonthFromPeriod(period, now = new Date()) {
    const monthMatch = /^month-(\d+)$/.exec(period || '');
    if (monthMatch) {
        const mi = Math.min(11, Math.max(0, parseInt(monthMatch[1], 10)));
        return { year: now.getFullYear(), monthIndex: mi };
    }
    if (period === 'current-year') {
        return { year: now.getFullYear(), monthIndex: now.getMonth() };
    }
    const { startDate, endDate } = getPeriodDateBounds(period, now);
    const t = now.getTime();
    if (t >= startDate.getTime() && t <= endDate.getTime()) {
        return { year: now.getFullYear(), monthIndex: now.getMonth() };
    }
    return { year: endDate.getFullYear(), monthIndex: endDate.getMonth() };
}

function sameCalendarDay(a, b) {
    return (
        a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate()
    );
}

function assignOutLevel(dayMap) {
    let max = 0;
    for (const agg of dayMap.values()) {
        if (agg.totalSaida > agg.totalEntrada && agg.totalSaida > max) {
            max = agg.totalSaida;
        }
    }
    for (const agg of dayMap.values()) {
        if (agg.totalSaida <= agg.totalEntrada || agg.totalSaida <= 0 || max <= 0) {
            agg.nivelSaida = 0;
            continue;
        }
        const ratio = agg.totalSaida / max;
        agg.nivelSaida = ratio > 0.66 ? 3 : ratio > 0.33 ? 2 : 1;
    }
}

/** Soma saídas do cartão no mês civil exibido (sem filtro de pago/ciclo). */
export function sumCardExpensesInMonth(cardId, expenses, year, monthIndex) {
    let sum = 0;
    const id = String(cardId);
    for (const t of expenses || []) {
        if (String(t.accountId) !== id) continue;
        const d = movementDateToJsDate(t.date);
        if (d.getFullYear() !== year || d.getMonth() !== monthIndex) continue;
        sum += Number(t.amount) || 0;
    }
    return sum;
}

/** Faturas por dia de vencimento civil no mês (dia → lista de cartões). */
export function buildInvoicesByDueDay(accounts, expenses, year, monthIndex) {
    const map = new Map();
    const last = new Date(year, monthIndex + 1, 0).getDate();

    for (const card of accounts || []) {
        if (!isCreditCardType(card.type)) continue;
        const dueDayNum = parseInt(String(card.dueDate ?? card.dueDay ?? ''), 10);
        if (!Number.isFinite(dueDayNum) || dueDayNum < 1) continue;
        const day = Math.min(last, dueDayNum);
        const amount = sumCardExpensesInMonth(card.id, expenses, year, monthIndex);
        if (!map.has(day)) map.set(day, []);
        map.get(day).push({
            cardId: card.id,
            cardName: card.name,
            amount
        });
    }
    return map;
}

/**
 * @returns {Map<number, { totalSaida, totalEntrada, temFatura, nivelSaida }>}
 */
export function buildMonthDayMap(expenses, gains, accounts, year, monthIndex) {
    const dayMap = new Map();
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
        dayMap.set(d, { totalSaida: 0, totalEntrada: 0, temFatura: false, nivelSaida: 0, faturas: [] });
    }

    const invoicesByDay = buildInvoicesByDueDay(accounts, expenses, year, monthIndex);
    invoicesByDay.forEach((list, d) => {
        const agg = dayMap.get(d);
        if (agg && list.length > 0) {
            agg.temFatura = true;
            agg.faturas = list;
        }
    });

    for (const t of expenses || []) {
        const d = movementDateToJsDate(t.date);
        if (d.getFullYear() !== year || d.getMonth() !== monthIndex) continue;
        const day = d.getDate();
        const agg = dayMap.get(day);
        if (agg) agg.totalSaida += Number(t.amount) || 0;
    }
    for (const t of gains || []) {
        const d = movementDateToJsDate(t.date);
        if (d.getFullYear() !== year || d.getMonth() !== monthIndex) continue;
        const day = d.getDate();
        const agg = dayMap.get(day);
        if (agg) agg.totalEntrada += Number(t.amount) || 0;
    }

    assignOutLevel(dayMap);
    return dayMap;
}

export function getDefaultSelectedDay(year, monthIndex, now = new Date()) {
    if (now.getFullYear() === year && now.getMonth() === monthIndex) {
        return now.getDate();
    }
    return 1;
}

export function clampSelectedDay(day, year, monthIndex) {
    const last = new Date(year, monthIndex + 1, 0).getDate();
    return Math.min(last, Math.max(1, day));
}

function expenseStatusLabel(t) {
    if (t.isPaid === true) return 'Pago';
    if (t.isPaid === false) return 'Pendente';
    return 'Saída';
}

/** Itens do dia para o painel (entradas, saídas, faturas), ordenados por valor desc. */
export function buildDayDetailItems(expenses, gains, accounts, year, monthIndex, day) {
    const target = new Date(year, monthIndex, day);
    const accountById = new Map((accounts || []).map((a) => [String(a.id), a]));
    const items = [];

    const invoicesByDay = buildInvoicesByDueDay(accounts, expenses, year, monthIndex);
    for (const inv of invoicesByDay.get(day) || []) {
        items.push({
            id: `inv-${inv.cardId}`,
            kind: 'invoice',
            title: `Fatura — ${inv.cardName}`,
            amount: inv.amount,
            bank: inv.cardName,
            tag: '',
            status: 'Vencimento',
            pending: false
        });
    }

    for (const t of expenses || []) {
        const d = movementDateToJsDate(t.date);
        if (!sameCalendarDay(d, target)) continue;
        const acc = accountById.get(String(t.accountId));
        items.push({
            id: `exp-${t.id}`,
            kind: 'expense',
            title: t.description || 'Saída',
            amount: Number(t.amount) || 0,
            bank: acc?.name || '—',
            tag: t.category || t.subcategory || '',
            status: expenseStatusLabel(t),
            pending: t.isPaid === false
        });
    }
    for (const t of gains || []) {
        const d = movementDateToJsDate(t.date);
        if (!sameCalendarDay(d, target)) continue;
        const acc = accountById.get(String(t.accountId));
        items.push({
            id: `gain-${t.id}`,
            kind: 'gain',
            title: t.description || 'Entrada',
            amount: Number(t.amount) || 0,
            bank: acc?.name || '—',
            tag: t.category || '',
            status: 'Recebido',
            pending: false
        });
    }

    items.sort((a, b) => b.amount - a.amount);
    return items;
}
