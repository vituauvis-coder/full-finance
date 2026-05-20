import { getChartAxisColors, isDarkTheme } from '../../core/utils.js';
import { baseChartOptions, colorWithAlpha } from '../../shared/chart-options.js';
import { buildMonthlyStackedSeries } from './aggregations.js';
import { bucketColorHex } from './constants.js';

let monthlyChart = null;

/** Mesmo espaçamento entre trechos que `.zero-budget__bar` (gap: 3px). */
const STACK_SEGMENT_GAP_PX = 3;

function bucketColor(bucket) {
    return bucketColorHex(bucket?.colorKey);
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
