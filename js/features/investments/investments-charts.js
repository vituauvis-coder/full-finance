import { formatCurrency, getChartAxisColors, isDarkTheme } from '../../core/utils.js';
import { buildMonthlyStackedSeries, buildPerformanceByBucket } from './aggregations.js';
import { bucketColorHex } from './constants.js';

let monthlyChart = null;
let performanceChart = null;

const INVESTED_COLOR = '#3b82f6';
const YIELD_COLOR = '#10b981';

function bucketColor(bucket) {
    return bucketColorHex(bucket?.colorKey);
}

function colorWithAlpha(hex, alpha) {
    const s = String(hex || '').trim();
    if (!s.startsWith('#') || (s.length !== 7 && s.length !== 4)) return s;
    let r;
    let g;
    let b;
    if (s.length === 7) {
        r = parseInt(s.slice(1, 3), 16);
        g = parseInt(s.slice(3, 5), 16);
        b = parseInt(s.slice(5, 7), 16);
    } else {
        r = parseInt(s[1] + s[1], 16);
        g = parseInt(s[2] + s[2], 16);
        b = parseInt(s[3] + s[3], 16);
    }
    if ([r, g, b].some((x) => Number.isNaN(x))) return s;
    return `rgba(${r},${g},${b},${alpha})`;
}

function stackedBarRadius(index, total) {
    if (total <= 1) return 6;
    if (index === 0) return { bottomLeft: 6, bottomRight: 6, topLeft: 0, topRight: 0 };
    if (index === total - 1) return { topLeft: 6, topRight: 6, bottomLeft: 0, bottomRight: 0 };
    return 0;
}

function chartTooltipPlugin(theme) {
    return {
        backgroundColor: isDarkTheme() ? 'rgba(15, 23, 42, 0.96)' : 'rgba(255, 255, 255, 0.98)',
        titleColor: theme.tick,
        bodyColor: theme.tick,
        borderColor: isDarkTheme() ? 'rgba(148, 163, 184, 0.35)' : 'rgba(71, 85, 105, 0.18)',
        borderWidth: 1,
        padding: 12,
        boxPadding: 6,
        titleFont: { size: 13, weight: '600' },
        bodyFont: { size: 12 }
    };
}

function chartLegendLabels(theme) {
    return {
        color: theme.tick,
        boxWidth: 10,
        boxHeight: 10,
        padding: 14,
        usePointStyle: true,
        pointStyle: 'rectRounded',
        font: { size: 11, weight: '600' }
    };
}

function chartScales(currency, theme, stacked = false) {
    return {
        x: {
            stacked,
            ticks: {
                color: colorWithAlpha(theme.tick, 0.72),
                maxRotation: 0,
                minRotation: 0,
                autoSkip: true,
                font: { size: 11, weight: '500' }
            },
            grid: { color: theme.grid, display: true }
        },
        y: {
            stacked,
            beginAtZero: true,
            ticks: {
                color: theme.tick,
                callback: (v) => formatCurrency(v, currency)
            },
            grid: {
                color: (ctx) => {
                    if (ctx.tick && Number(ctx.tick.value) === 0) {
                        return colorWithAlpha(theme.tick, 0.42);
                    }
                    return theme.grid;
                },
                lineWidth: (ctx) => (ctx.tick && Number(ctx.tick.value) === 0 ? 2 : 1)
            }
        }
    };
}

function baseChartOptions(currency, theme, { stacked = false, legend = false } = {}) {
    return {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        datasets: {
            bar: {
                categoryPercentage: 0.72,
                barPercentage: 0.85,
                borderSkipped: false
            }
        },
        plugins: {
            legend: legend
                ? {
                      display: true,
                      position: 'top',
                      align: 'end',
                      labels: chartLegendLabels(theme)
                  }
                : { display: false },
            tooltip: {
                ...chartTooltipPlugin(theme),
                callbacks: {
                    label: (ctx) =>
                        `${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y, currency)}`
                }
            }
        },
        scales: chartScales(currency, theme, stacked)
    };
}

export function destroyInvestmentCharts() {
    if (monthlyChart) {
        monthlyChart.destroy();
        monthlyChart = null;
    }
    if (performanceChart) {
        performanceChart.destroy();
        performanceChart = null;
    }
}

export function renderInvestmentCharts(buckets, applications, currency, expenses = []) {
    renderMonthlyChart(buckets, applications, currency, expenses);
    renderPerformanceChart(buckets, applications, currency, expenses);
    renderMonthlyLegend(buckets);
}

function renderMonthlyLegend(buckets) {
    const el = document.getElementById('investments-monthly-legend');
    if (!el) return;
    el.innerHTML = (buckets || [])
        .map(
            (b) =>
                `<span class="investments-page__legend-item"><span class="investments-page__legend-dot" style="background:${bucketColor(b)}"></span>${escapeHtml(b.name)}</span>`
        )
        .join('');
}

function renderMonthlyChart(buckets, applications, currency, expenses = []) {
    const canvas = document.getElementById('investments-monthly-chart');
    if (!canvas || typeof Chart === 'undefined') return;

    const series = buildMonthlyStackedSeries(applications, buckets, expenses);
    const labels = series.map((r) => r.label);
    const theme = getChartAxisColors();
    const bucketList = buckets || [];
    const totalStacks = bucketList.length;

    const datasets = bucketList.map((b, index) => ({
        label: b.name,
        data: series.map((r) => r[b.id] || 0),
        backgroundColor: colorWithAlpha(bucketColor(b), 0.92),
        borderColor: colorWithAlpha(bucketColor(b), 0.92),
        borderWidth: 0,
        borderRadius: stackedBarRadius(index, totalStacks),
        borderSkipped: false,
        stack: 'stack0'
    }));

    if (monthlyChart) monthlyChart.destroy();
    monthlyChart = new Chart(canvas, {
        type: 'bar',
        data: { labels, datasets },
        options: baseChartOptions(currency, theme, { stacked: true })
    });
}

function renderPerformanceChart(buckets, applications, currency, expenses = []) {
    const canvas = document.getElementById('investments-performance-chart');
    if (!canvas || typeof Chart === 'undefined') return;

    const perf = buildPerformanceByBucket(buckets, applications, expenses);
    const labels = perf.map((p) => p.name);
    const theme = getChartAxisColors();

    if (performanceChart) performanceChart.destroy();
    performanceChart = new Chart(canvas, {
        type: 'bar',
        data: {
            labels,
            datasets: [
                {
                    label: 'Investido',
                    data: perf.map((p) => p.investido),
                    backgroundColor: colorWithAlpha(INVESTED_COLOR, 0.92),
                    borderColor: colorWithAlpha(INVESTED_COLOR, 0.92),
                    borderWidth: 0,
                    borderRadius: { bottomLeft: 6, bottomRight: 6, topLeft: 0, topRight: 0 },
                    borderSkipped: false,
                    stack: 'p'
                },
                {
                    label: 'Lucro (est.)',
                    data: perf.map((p) => p.lucro),
                    backgroundColor: colorWithAlpha(YIELD_COLOR, 0.92),
                    borderColor: colorWithAlpha(YIELD_COLOR, 0.92),
                    borderWidth: 0,
                    borderRadius: { topLeft: 6, topRight: 6, bottomLeft: 0, bottomRight: 0 },
                    borderSkipped: false,
                    stack: 'p'
                }
            ]
        },
        options: baseChartOptions(currency, theme, { stacked: true, legend: true })
    });

    const kpiEl = document.getElementById('investments-performance-kpis');
    if (kpiEl) {
        const lucroTotal = perf.reduce((s, p) => s + p.lucro, 0);
        const totalAportado = perf.reduce((s, p) => s + p.investido, 0);
        const lucroMensal = (totalAportado + lucroTotal) * 0.009;
        const lucroDiario = lucroMensal / 22;
        kpiEl.innerHTML = `
            <div>
                <span class="investments-page__kpi-label">Rende por dia (est.)</span>
                <span class="investments-page__kpi-value investments-page__kpi-value--up">${formatCurrency(lucroDiario, currency)}</span>
            </div>
            <div>
                <span class="investments-page__kpi-label">Rende por mês (est.)</span>
                <span class="investments-page__kpi-value investments-page__kpi-value--up">${formatCurrency(lucroMensal, currency)}</span>
            </div>`;
    }
}

function escapeHtml(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
}
