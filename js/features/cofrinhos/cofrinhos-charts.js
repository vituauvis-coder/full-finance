import { formatCurrency, getChartAxisColors, isDarkTheme } from '../../core/utils.js';
import { buildMonthlyStackedSeries } from './aggregations.js';
import { bucketColorHex } from './constants.js';

let monthlyChart = null;

/** Mesmo espaçamento entre trechos que `.zero-budget__bar` (gap: 3px). */
const STACK_SEGMENT_GAP_PX = 3;

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

function chartStackGapBorderColor(canvas) {
    const card = canvas?.closest?.('.cofrinhos-page__chart-card, .reports-chart-container');
    if (card) {
        const bg = getComputedStyle(card).backgroundColor;
        if (bg && bg !== 'rgba(0, 0, 0, 0)') return bg;
    }
    return isDarkTheme() ? 'rgb(30, 41, 59)' : 'rgb(250, 250, 250)';
}

/** Borda só entre segmentos empilhados (não nas extremidades da coluna). */
function stackedSegmentBorderWidth(ctx, gapPx = STACK_SEGMENT_GAP_PX) {
    const { chart, datasetIndex, dataIndex } = ctx;
    const datasets = chart?.data?.datasets;
    if (!datasets?.length) return 0;

    const stackName = datasets[datasetIndex]?.stack;
    if (!stackName) return 0;

    const activeIndices = datasets
        .map((ds, i) => ({
            i,
            v: Number(ds.data?.[dataIndex]) || 0,
            stack: ds.stack
        }))
        .filter((x) => x.stack === stackName && x.v > 0)
        .map((x) => x.i);

    const pos = activeIndices.indexOf(datasetIndex);
    if (pos === -1) return 0;

    const half = gapPx / 2;
    return {
        top: pos < activeIndices.length - 1 ? half : 0,
        bottom: pos > 0 ? half : 0,
        left: 0,
        right: 0
    };
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

export function destroyCofrinhoCharts() {
    if (monthlyChart) {
        monthlyChart.destroy();
        monthlyChart = null;
    }
}

/**
 * @param {{ onMonthSelect?: (yearMonth: string) => void }} [options]
 */
export function renderCofrinhoCharts(buckets, applications, currency, expenses = [], options = {}) {
    renderMonthlyChart(buckets, applications, currency, expenses, options);
    renderMonthlyLegend(buckets);
}

function renderMonthlyLegend(buckets) {
    const el = document.getElementById('cofrinhos-monthly-legend');
    if (!el) return;
    el.innerHTML = (buckets || [])
        .map(
            (b) =>
                `<span class="cofrinhos-page__legend-item"><span class="cofrinhos-page__legend-dot" style="background:${bucketColor(b)}"></span>${escapeHtml(b.name)}</span>`
        )
        .join('');
}

function renderMonthlyChart(buckets, applications, currency, expenses = [], options = {}) {
    const canvas = document.getElementById('cofrinhos-monthly-chart');
    if (!canvas || typeof Chart === 'undefined') return;

    const series = buildMonthlyStackedSeries(applications, buckets, expenses);
    const labels = series.map((r) => r.label);
    const theme = getChartAxisColors();
    const bucketList = buckets || [];
    const totalStacks = bucketList.length;

    const gapBorderColor = chartStackGapBorderColor(canvas);

    const datasets = bucketList.map((b, index) => ({
        label: b.name,
        data: series.map((r) => r[b.id] || 0),
        backgroundColor: colorWithAlpha(bucketColor(b), 0.92),
        borderColor: gapBorderColor,
        borderWidth: (ctx) => stackedSegmentBorderWidth(ctx),
        borderRadius: stackedBarRadius(index, totalStacks),
        borderSkipped: false,
        stack: 'stack0'
    }));

    const chartOptions = baseChartOptions(currency, theme, { stacked: true });
    chartOptions.onClick = (_evt, els) => {
        if (!els?.length) return;
        const idx = els[0]?.index;
        if (typeof idx !== 'number') return;
        const row = series[idx];
        if (!row?.yearMonth) return;
        options.onMonthSelect?.(row.yearMonth);
    };
    chartOptions.onHover = (_evt, els) => {
        canvas.style.cursor = els?.length ? 'pointer' : 'default';
    };

    if (monthlyChart) monthlyChart.destroy();
    monthlyChart = new Chart(canvas, {
        type: 'bar',
        data: { labels, datasets },
        options: chartOptions
    });
}

function escapeHtml(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
}
