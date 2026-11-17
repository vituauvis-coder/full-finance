import { isCreditCardType } from './account-type.js';
import { movementDateToJsDate } from './movement-date.js';

function movementDate(movement) {
    return movementDateToJsDate(movement?.date);
}

function sameCalendarDay(a, b) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function assignOutLevel(dayMap) {
    let max = 0;
    for (const agg of dayMap.values()) {
        if (agg.totalSaida > agg.totalEntrada && agg.totalSaida > max) max = agg.totalSaida;
    }
    for (const agg of dayMap.values()) {
        if (agg.totalSaida <= agg.totalEntrada || agg.totalSaida <= 0 || max <= 0) {
            agg.nivelSaida = 0;
        } else {
            const ratio = agg.totalSaida / max;
            agg.nivelSaida = ratio > 0.66 ? 3 : ratio > 0.33 ? 2 : 1;
        }
    }
}

export function sumCardExpensesInMonth(cardId, expenses, year, monthIndex) {
    let sum = 0;
    const id = String(cardId);
    for (const t of expenses || []) {
        if (String(t.accountId) !== id) continue;
        const d = movementDate(t);
        if (d.getFullYear() !== year || d.getMonth() !== monthIndex) continue;
        sum += Number(t.amount) || 0;
    }
    return sum;
}

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
        map.get(day).push({ cardId: card.id, cardName: card.name, amount });
    }
    return map;
}

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
        const d = movementDate(t);
        if (d.getFullYear() !== year || d.getMonth() !== monthIndex) continue;
        const agg = dayMap.get(d.getDate());
        if (agg) agg.totalSaida += Number(t.amount) || 0;
    }
    for (const t of gains || []) {
        const d = movementDate(t);
        if (d.getFullYear() !== year || d.getMonth() !== monthIndex) continue;
        const agg = dayMap.get(d.getDate());
        if (agg) agg.totalEntrada += Number(t.amount) || 0;
    }

    assignOutLevel(dayMap);
    return dayMap;
}

function expenseStatusLabel(t) {
    if (t.isPaid === true) return 'Pago';
    if (t.isPaid === false) return 'Pendente';
    return 'Saída';
}

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
        const d = movementDate(t);
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
        const d = movementDate(t);
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