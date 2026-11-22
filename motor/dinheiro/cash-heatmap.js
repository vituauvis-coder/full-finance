import { isCreditCardType } from './account-type.js';
import { getExpensePerInstallmentDisplayAmount } from './credit-installments.js';
import { filterExpenseRowsForListPeriod } from './expense-list-period.js';
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

export function sumCardExpensesInMonth(cardId, expenses, year, monthIndex, accounts = []) {
    const start = new Date(year, monthIndex, 1);
    const end = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);
    const accountById = new Map((accounts || []).map((a) => [String(a.id), a]));
    const id = String(cardId);
    const inPeriod = filterExpenseRowsForListPeriod(expenses, accounts, start, end);
    let sum = 0;
    for (const t of inPeriod) {
        if (String(t.accountId) !== id) continue;
        const acc = accountById.get(id);
        if (!acc || !isCreditCardType(acc.type)) continue;
        const amt = getExpensePerInstallmentDisplayAmount(t, acc) || Number(t.amount) || 0;
        if (amt > 0) sum += amt;
    }
    return sum;
}

/** Totais de fatura por dia de vencimento (mês da fatura, igual à lista de Saídas). */
export function buildInvoicesByDueDay(accounts, expenses, year, monthIndex) {
    const start = new Date(year, monthIndex, 1);
    const end = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);
    const last = end.getDate();
    const accountById = new Map((accounts || []).map((a) => [String(a.id), a]));
    const map = new Map();

    const inPeriod = filterExpenseRowsForListPeriod(expenses, accounts, start, end);
    const totalsByCard = new Map();

    for (const t of inPeriod) {
        const acc = t.accountId ? accountById.get(String(t.accountId)) : undefined;
        if (!acc || !isCreditCardType(acc.type)) continue;
        const cardId = String(acc.id);
        const amt = getExpensePerInstallmentDisplayAmount(t, acc) || Number(t.amount) || 0;
        if (!Number.isFinite(amt) || amt <= 0) continue;
        totalsByCard.set(cardId, (totalsByCard.get(cardId) || 0) + amt);
    }

    for (const card of accounts || []) {
        if (!isCreditCardType(card.type)) continue;
        const cardId = String(card.id);
        const amount = totalsByCard.get(cardId) ?? 0;
        if (amount <= 0) continue;

        const dueDayNum = parseInt(String(card.dueDate ?? card.dueDay ?? ''), 10);
        if (!Number.isFinite(dueDayNum) || dueDayNum < 1) continue;
        const day = Math.min(last, dueDayNum);
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

/** Agregação por mês civil (12 células) — visão «ano inteiro» da Carteira. */
export function buildYearMonthMap(expenses, gains, accounts, year) {
    const monthMap = new Map();
    for (let monthIndex = 0; monthIndex < 12; monthIndex++) {
        const dayMap = buildMonthDayMap(expenses, gains, accounts, year, monthIndex);
        let totalSaida = 0;
        let totalEntrada = 0;
        let temFatura = false;
        const faturas = [];
        for (const agg of dayMap.values()) {
            totalSaida += agg.totalSaida;
            totalEntrada += agg.totalEntrada;
            if (agg.temFatura) {
                temFatura = true;
                faturas.push(...(agg.faturas || []));
            }
        }
        monthMap.set(monthIndex, {
            totalSaida,
            totalEntrada,
            temFatura,
            nivelSaida: 0,
            faturas
        });
    }
    assignOutLevel(monthMap);
    return monthMap;
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

    const periodStart = new Date(year, monthIndex, 1);
    const periodEnd = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);
    const inPeriod = filterExpenseRowsForListPeriod(expenses, accounts, periodStart, periodEnd);

    for (const t of inPeriod) {
        const d = movementDate(t);
        if (!sameCalendarDay(d, target)) continue;
        const acc = accountById.get(String(t.accountId));
        if (acc && isCreditCardType(acc.type)) continue;
        const displayAmt = getExpensePerInstallmentDisplayAmount(t, acc) || Number(t.amount) || 0;
        items.push({
            id: `exp-${t.id}`,
            kind: 'expense',
            title: t.description || 'Saída',
            amount: displayAmt,
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