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

/**
 * Limites [startDate, endDate] inclusive para filtros por data de lançamento.
 */
export function getPeriodDateBounds(period, now = new Date()) {
    let startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    let endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const monthMatch = /^month-(\d+)$/.exec(period || '');
    if (monthMatch) {
        const mi = Math.min(11, Math.max(0, parseInt(monthMatch[1], 10)));
        const y = now.getFullYear();
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
export function getMonthKeysInPeriod(period, now = new Date()) {
    const { startDate, endDate } = getPeriodDateBounds(period, now);
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
export function getPeriodTitleParts(period, now = new Date()) {
    const y = now.getFullYear();
    const monthMatch = /^month-(\d+)$/.exec(period || '');
    if (monthMatch) {
        const mi = Math.min(11, Math.max(0, parseInt(monthMatch[1], 10)));
        return { kind: 'month', label: `${MONTH_NAMES_PT[mi]} ${y}` };
    }
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

/** Valor inicial do filtro de período só do painel (gráfico anual por padrão). */
export function getDashboardChartDefaultPeriodValue() {
    return 'current-year';
}

/** Atribui o mês atual em Saídas/Entradas e «Este ano» no painel (gráfico). */
export function syncPeriodFilterSelectsToCurrentMonth(now = new Date()) {
    const v = getDefaultPeriodValue(now);
    for (const id of ['expenses-period-filter', 'gains-period-filter']) {
        const el = document.getElementById(id);
        if (el && el.querySelector(`option[value="${v}"]`)) {
            el.value = v;
        }
    }
    const dash = document.getElementById('period-filter');
    const y = getDashboardChartDefaultPeriodValue();
    if (dash && dash.querySelector(`option[value="${y}"]`)) {
        dash.value = y;
    }
}
