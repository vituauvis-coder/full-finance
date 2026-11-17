import { EXPENSE_COFRINHO_CATEGORY, isCofrinhoPoolSubcategoryName } from './constants.js';
import { movementDateToJsDate } from '../../core/utils.js';

/** @returns {string} `YYYY-MM` */
export function toYearMonthKey(dateLike) {
    const s = String(dateLike ?? '').trim();
    const prefix = s.match(/^(\d{4})-(\d{2})/);
    if (prefix) return `${prefix[1]}-${prefix[2]}`;
    const d = movementDateToJsDate(dateLike);
    if (Number.isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Primeiro dia do mês (`YYYY-MM-01`) para API. */
export function yearMonthToReferenceMonth(ym) {
    if (!ym || !/^\d{4}-\d{2}$/.test(ym)) return null;
    return `${ym}-01`;
}

/** @param {string} referenceMonth ISO date ou YYYY-MM */
export function referenceMonthToYearMonth(referenceMonth) {
    if (!referenceMonth) return '';
    const m = String(referenceMonth).trim().match(/^(\d{4})-(\d{2})/);
    if (m) return `${m[1]}-${m[2]}`;
    return toYearMonthKey(referenceMonth);
}

export function isCofrinhoPoolExpense(expense) {
    if (String(expense?.category || '').trim() !== EXPENSE_COFRINHO_CATEGORY) return false;
    if (expense?.allocationParentId) return false;
    return isCofrinhoPoolSubcategoryName(expense?.subcategory);
}

/**
 * Soma saídas pool (Cofrinhos / subcategoria Pool, pagas) do mês M.
 * @param {object[]} expenses
 * @param {string} yearMonth `YYYY-MM`
 */
export function sumCofrinhoPoolForMonth(expenses, yearMonth) {
    if (!yearMonth || !Array.isArray(expenses)) return 0;
    return expenses.reduce((sum, e) => {
        if (!isCofrinhoPoolExpense(e)) return sum;
        if (e.isPaid === false) return sum;
        if (toYearMonthKey(e.date) !== yearMonth) return sum;
        return sum + (parseFloat(e.amount) || 0);
    }, 0);
}

/**
 * @deprecated Mantido para gráficos legados; pendente usa só pool.
 */
export function sumApplicationsForMonth(applications, yearMonth) {
    if (!yearMonth || !Array.isArray(applications)) return 0;
    return applications.reduce((sum, a) => {
        if (referenceMonthToYearMonth(a.referenceMonth) !== yearMonth) return sum;
        return sum + (parseFloat(a.amount) || 0);
    }, 0);
}

/** Soma saldo pool em todas as saídas (sem filtro de mês). */
export function sumCofrinhoPoolTotal(expenses) {
    if (!Array.isArray(expenses)) return 0;
    return expenses.reduce((sum, e) => {
        if (!isCofrinhoPoolExpense(e)) return sum;
        if (e.isPaid === false) return sum;
        return sum + (parseFloat(e.amount) || 0);
    }, 0);
}

/**
 * Saldo aguardando alocação (= saídas na subcategoria Pool).
 * Com `yearMonth`, limita ao mês; sem mês, soma todo o período.
 * @returns {number}
 */
export function computePendingBalance(expenses, _applications, yearMonth) {
    const raw = yearMonth
        ? sumCofrinhoPoolForMonth(expenses, yearMonth)
        : sumCofrinhoPoolTotal(expenses);
    return Math.max(0, Math.round(raw * 100) / 100);
}

/**
 * Lista saídas pool do mês (para select no modal).
 * @param {object[]} expenses
 * @param {string} yearMonth
 */
export function listPoolExpensesForMonth(expenses, yearMonth) {
    if (!yearMonth || !Array.isArray(expenses)) return [];
    return expenses
        .filter((e) => isCofrinhoPoolExpense(e) && e.isPaid !== false && toYearMonthKey(e.date) === yearMonth)
        .sort((a, b) => String(a.date).localeCompare(String(b.date)));
}
