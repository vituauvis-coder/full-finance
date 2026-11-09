/**
 * Valores do filtro de período (dashboard, saídas, entradas).
 * Meses: month-0 = Janeiro do ano civil atual … month-11 = Dezembro.
 */

/** Período padrão: mês calendário atual (ano civil corrente). */
export function getDefaultPeriodValue(now = new Date()) {
    return `month-${now.getMonth()}`;
}

export function isDefaultPeriodValue(period, now = new Date()) {
    return period === getDefaultPeriodValue(now);
}

/** Ano padrão nas listas Entradas/Saídas (ano civil corrente). */
export function getDefaultCivilYear(now = new Date()) {
    return now.getFullYear();
}

/** Mês + ano civil padrão (chips + ‹ ano ›). */
export function isMovementListDefaultMonthAndYear(period, civilYear, now = new Date()) {
    const y = Number(civilYear);
    const year = Number.isFinite(y) ? y : getDefaultCivilYear(now);
    return isDefaultPeriodValue(period, now) && year === getDefaultCivilYear(now);
}

/**
 * Limites [startDate, endDate] inclusive para filtros por data de lançamento.
 * @param {{ civilYear?: number }} [options] — ano civil para `month-N` (listas Entradas/Saídas).
 */
export function getPeriodDateBounds(period, now = new Date(), options = {}) {
    const civilYearOpt = options.civilYear;
    const civilYear =
        civilYearOpt != null && Number.isFinite(Number(civilYearOpt))
            ? Number(civilYearOpt)
            : now.getFullYear();

    let startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    let endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const monthMatch = /^month-(\d+)$/.exec(period || '');
    if (monthMatch) {
        const mi = Math.min(11, Math.max(0, parseInt(monthMatch[1], 10)));
        const y = civilYear;
        startDate = new Date(y, mi, 1);
        endDate = new Date(y, mi + 1, 0, 23, 59, 59, 999);
        return { startDate, endDate };
    }

    switch (period) {
        case 'last-3-months':
            startDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
            endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
            break;
        case 'last-6-months':
            startDate = new Date(now.getFullYear(), now.getMonth() - 5, 1);
            endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
            break;
        case 'last-12-months':
            startDate = new Date(now.getFullYear(), now.getMonth() - 11, 1);
            endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
            break;
        case 'current-year':
            startDate = new Date(now.getFullYear(), 0, 1);
            endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
            break;
        case 'last-year':
            startDate = new Date(now.getFullYear() - 1, 0, 1);
            endDate = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
            break;
        default:
            break;
    }

    return { startDate, endDate };
}

/** Chaves YYYY-MM dos meses calendário entre os limites (inclusive). */
export function getMonthKeysInPeriod(period, now = new Date(), options = {}) {
    const { startDate, endDate } = getPeriodDateBounds(period, now, options);
    const keys = [];
    let y = startDate.getFullYear();
    let m = startDate.getMonth();
    const endY = endDate.getFullYear();
    const endM = endDate.getMonth();
    while (y < endY || (y === endY && m <= endM)) {
        keys.push(`${y}-${String(m + 1).padStart(2, '0')}`);
        m++;
        if (m > 11) {
            m = 0;
            y++;
        }
    }
    return keys;
}

/** Rótulos curtos dos 12 meses (chips Jan/26 — Planejamento, Carteira, Saídas). */
export const CIVIL_MONTH_CHIP_NAMES = [
    'Jan',
    'Fev',
    'Mar',
    'Abr',
    'Mai',
    'Jun',
    'Jul',
    'Ago',
    'Set',
    'Out',
    'Nov',
    'Dez'
];

let expensesPeriodTimelineRefresh = null;
let gainsPeriodTimelineRefresh = null;
let dashboardPeriodTimelineRefresh = null;

/** Registro do render dos chips de mês em Saídas (evita import circular). */
export function registerExpensesPeriodTimelineRefresh(fn) {
    expensesPeriodTimelineRefresh = typeof fn === 'function' ? fn : null;
}

/** Registro do render dos chips de mês em Entradas (evita import circular). */
export function registerGainsPeriodTimelineRefresh(fn) {
    gainsPeriodTimelineRefresh = typeof fn === 'function' ? fn : null;
}

/** Registro do render dos chips de mês no painel (evita import circular). */
export function registerDashboardPeriodTimelineRefresh(fn) {
    dashboardPeriodTimelineRefresh = typeof fn === 'function' ? fn : null;
}

export function getDashboardCivilYearFromDom() {
    const el = document.getElementById('dashboard-period-year');
    const y = parseInt(String(el?.value ?? '').trim(), 10);
    return Number.isFinite(y) && y >= 1970 && y <= 2100 ? y : getDefaultCivilYear();
}

export function setDashboardCivilYearInDom(year) {
    const y = Number.isFinite(Number(year)) ? Number(year) : getDefaultCivilYear();
    const el = document.getElementById('dashboard-period-year');
    if (el) el.value = String(y);
    const label = document.querySelector('#dashboard-page [data-civil-period-year-label]');
    if (label) label.textContent = String(y);
}

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

/**
 * Rótulos para títulos de gráficos / cards.
 * kind: 'year' | 'month' | 'range'
 */
export function getPeriodTitleParts(period, now = new Date(), options = {}) {
    const monthMatch = /^month-(\d+)$/.exec(period || '');
    if (monthMatch) {
        const mi = Math.min(11, Math.max(0, parseInt(monthMatch[1], 10)));
        const civilYearOpt = options.civilYear;
        const y =
            civilYearOpt != null && Number.isFinite(Number(civilYearOpt))
                ? Number(civilYearOpt)
                : now.getFullYear();
        return { kind: 'month', label: `${MONTH_NAMES_PT[mi]} ${y}` };
    }
    const y = now.getFullYear();
    switch (period) {
        case 'current-year':
            return { kind: 'year', label: String(y) };
        case 'last-year':
            return { kind: 'year', label: String(y - 1) };
        case 'last-3-months':
            return { kind: 'range', label: 'Últimos 3 meses' };
        case 'last-6-months':
            return { kind: 'range', label: 'Últimos 6 meses' };
        case 'last-12-months':
            return { kind: 'range', label: 'Últimos 12 meses' };
        default:
            return { kind: 'range', label: 'Período selecionado' };
    }
}

/** Valor inicial do filtro de período do painel (mesmo que saídas/entradas: mês civil atual). */
export function getDashboardChartDefaultPeriodValue(now = new Date()) {
    return getDefaultPeriodValue(now);
}

/** Atribui o mês atual no painel, Saídas e Entradas. */
export function syncPeriodFilterSelectsToCurrentMonth(now = new Date()) {
    const v = getDefaultPeriodValue(now);
    const y = String(getDefaultCivilYear(now));
    const expensesPeriod = document.getElementById('expenses-period-filter');
    if (expensesPeriod) expensesPeriod.value = v;
    const expensesYear = document.getElementById('expenses-period-year');
    if (expensesYear) expensesYear.value = y;
    expensesPeriodTimelineRefresh?.();
    const gainsPeriod = document.getElementById('gains-period-filter');
    if (gainsPeriod) gainsPeriod.value = v;
    const gainsYear = document.getElementById('gains-period-year');
    if (gainsYear) gainsYear.value = y;
    gainsPeriodTimelineRefresh?.();
    const periodEl = document.getElementById('period-filter');
    if (periodEl) periodEl.value = v;
    const dashboardYear = document.getElementById('dashboard-period-year');
    if (dashboardYear) dashboardYear.value = y;
    setDashboardCivilYearInDom(y);
    dashboardPeriodTimelineRefresh?.();
}
