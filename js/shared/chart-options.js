import { formatCurrency, isDarkTheme } from '../core/utils.js';

export function colorWithAlpha(hex, alpha) {
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

export function chartTooltipPlugin(theme) {
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

export function chartLegendLabels(theme) {
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

export function chartScales(currency, theme, stacked = false) {
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

/**
 * Opções padrão dos gráficos de página (Cofrinhos, Dívidas, etc.).
 * @param {string} currency
 * @param {{ tick: string, grid: string }} theme
 * @param {{ stacked?: boolean, legend?: boolean }} [opts]
 */
export function baseChartOptions(currency, theme, { stacked = false, legend = false } = {}) {
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
                    label: (ctx) => {
                        const v = ctx.parsed.y;
                        if (v == null || Number.isNaN(v)) return null;
                        return `${ctx.dataset.label}: ${formatCurrency(v, currency)}`;
                    }
                }
            }
        },
        scales: chartScales(currency, theme, stacked)
    };
}
