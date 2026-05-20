import { movementDateToJsDate, getChartAxisColors } from '../../core/utils.js';
import { monthKey, enumerateCalendarYearMonths } from './debts-aggregations.js';
import { debtColorHex } from './constants.js';
import { baseChartOptions, colorWithAlpha } from '../../shared/chart-options.js';

let balanceChart = null;

/** Série mensal com valor do mês ou último conhecido (carry-forward). */
function debtAmountSeriesByMonth(updates, monthKeysList) {
    const lastByMonth = new Map();
    (updates || []).forEach((u) => {
        const d = movementDateToJsDate(u.date);
        const mk = monthKey(d);
        lastByMonth.set(mk, Number(u.amount) || 0);
    });
    const lineData = [];
    const carried = [];
    let last = null;
    monthKeysList.forEach((mk) => {
        if (lastByMonth.has(mk)) last = lastByMonth.get(mk);
        lineData.push(lastByMonth.has(mk) ? last : null);
        carried.push(last ?? 0);
    });
    return { lineData, carried };
}

export function destroyDebtsCharts() {
    if (balanceChart) {
        balanceChart.destroy();
        balanceChart = null;
    }
}

export function renderDebtsBalanceChart(debts, updates, currency) {
    const canvas = document.getElementById('debts-balance-chart');
    if (!canvas || typeof Chart === 'undefined') return;

    const uList = (updates || []).slice();
    if (uList.length === 0) {
        if (balanceChart) {
            balanceChart.destroy();
            balanceChart = null;
        }
        return;
    }

    const chartYear = new Date().getFullYear();
    const months = enumerateCalendarYearMonths(chartYear);
    const labels = months.map((m) => m.toLocaleDateString('pt-BR', { month: 'short' }));
    const monthKeysList = months.map((m) => monthKey(m));

    const debtById = new Map((debts || []).map((d) => [d.id, d]));
    const byDebt = new Map();
    uList.forEach((u) => {
        if (!byDebt.has(u.debtId)) byDebt.set(u.debtId, []);
        byDebt.get(u.debtId).push(u);
    });
    byDebt.forEach((arr) => arr.sort((a, b) => movementDateToJsDate(a.date) - movementDateToJsDate(b.date)));

    const datasets = [];
    const totalByMonth = monthKeysList.map(() => 0);

    [...byDebt.entries()].forEach(([debtId, arr]) => {
        const debt = debtById.get(debtId);
        const company = debt?.company || 'Dívida';
        const color = debtColorHex(debt?.colorKey);
        const { lineData, carried } = debtAmountSeriesByMonth(arr, monthKeysList);

        carried.forEach((v, i) => {
            totalByMonth[i] += v;
        });

        datasets.push({
            type: 'line',
            label: company,
            data: lineData,
            borderColor: color,
            backgroundColor: 'transparent',
            borderWidth: 2,
            tension: 0.35,
            spanGaps: true,
            pointRadius: 4,
            pointHoverRadius: 6,
            pointBackgroundColor: color,
            pointBorderColor: color,
            order: 1
        });
    });

    const totalColor = debtColorHex('wine');
    datasets.unshift({
        type: 'bar',
        label: 'Total',
        data: totalByMonth,
        backgroundColor: colorWithAlpha(totalColor, 0.38),
        borderColor: colorWithAlpha(totalColor, 0.92),
        borderWidth: 0,
        borderRadius: 6,
        borderSkipped: false,
        order: 2
    });

    const theme = getChartAxisColors();
    const chartOptions = baseChartOptions(currency, theme, { legend: true });

    if (balanceChart) balanceChart.destroy();
    balanceChart = new Chart(canvas, {
        type: 'bar',
        data: { labels, datasets },
        options: chartOptions
    });
}

export function renderDebtsCharts(debts, updates, currency) {
    renderDebtsBalanceChart(debts, updates, currency);
}
