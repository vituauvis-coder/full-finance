/**
 * Treemap por categoria — Saídas (paleta padrão) ou Entradas (tons de verde).
 */

/** @typedef {{ name: string, total: number, subcategories: Array<{ name: string, total: number }> }} SpendingCategoryBlock */

export const SPENDING_TREEMAP_DEMAIS_LABEL = 'Demais categorias';
export const SPENDING_TREEMAP_MAX_BLOCKS = 16;

/** Tons de verde (e teal/lime próximos) — contraste com texto branco nos blocos. */
export const INCOME_TREEMAP_PALETTE = [
    '#22c55e',
    '#10b981',
    '#059669',
    '#0d9488',
    '#14b8a6',
    '#16a34a',
    '#15803d',
    '#166534',
    '#047857',
    '#065f46',
    '#0f766e',
    '#115e59',
    '#65a30d',
    '#4d7c0f'
];

export function buildTreemapBlocksForDisplay(sortedCategories) {
    if (sortedCategories.length <= SPENDING_TREEMAP_MAX_BLOCKS) {
        return { blocks: sortedCategories, mergedCount: 0 };
    }
    const head = sortedCategories.slice(0, SPENDING_TREEMAP_MAX_BLOCKS - 1);
    const tail = sortedCategories.slice(SPENDING_TREEMAP_MAX_BLOCKS - 1);
    const demaisTotal = tail.reduce((s, c) => s + c.total, 0);
    const subcategories = tail.map((c) => ({ name: c.name, total: c.total })).sort((a, b) => b.total - a.total);
    return {
        blocks: [...head, { name: SPENDING_TREEMAP_DEMAIS_LABEL, total: demaisTotal, subcategories }],
        mergedCount: tail.length
    };
}

const CATEGORY_SOLID_COLORS = [
    '#3b82f6',
    '#10b981',
    '#f43f5e',
    '#f59e0b',
    '#06b6d4',
    '#64748b',
    '#ec4899',
    '#0ea5e9',
    '#14b8a6',
    '#f97316',
    '#84cc16',
    '#ef4444',
    '#78716c',
    '#2563eb'
];

const treemapChartByContainerId = new Map();

function destroyTreemapChartForContainer(container) {
    const id = container?.id;
    if (!id) return;
    const ch = treemapChartByContainerId.get(id);
    if (ch) {
        ch.destroy();
        treemapChartByContainerId.delete(id);
    }
}

function escapePanelText(s, esc) {
    const fn = typeof esc === 'function' ? esc : (x) => String(x ?? '');
    return fn(String(s ?? ''));
}

function lightenHex(hex) {
    if (!hex || !hex.startsWith('#') || hex.length !== 7) return hex;
    const n = parseInt(hex.slice(1), 16);
    const ch = (shift) => (n >> shift) & 0xff;
    const mix = (shift) => Math.min(255, Math.round(ch(shift) + (255 - ch(shift)) * 0.16));
    return `rgb(${mix(16)},${mix(8)},${mix(0)})`;
}

/**
 * @param {SpendingCategoryBlock[]} displayCategories
 */
export function buildSpendingTreemapTreeFromDisplayCategories(displayCategories) {
    return (displayCategories || [])
        .filter((c) => (Number(c.total) || 0) > 0)
        .map((c) => ({ category: c.name, value: Number(c.total) }));
}

function getOrCreateHoverPanel(wrap) {
    let el = wrap.querySelector('.stm-hover-panel');
    if (!el) {
        el = document.createElement('div');
        el.className = 'stm-hover-panel';
        el.setAttribute('aria-hidden', 'true');
        wrap.appendChild(el);
    }
    return el;
}

function hideHoverPanel(wrap) {
    const el = wrap.querySelector('.stm-hover-panel');
    if (el) el.classList.remove('stm-hover-panel--visible');
}

function renderHoverPanel({
    wrap,
    catData,
    color,
    treemapTotal,
    formatCurrency,
    currency,
    caretX,
    caretY,
    chartW,
    chartH,
    escapeHtml
}) {
    const esc = (s) => escapePanelText(s, escapeHtml);
    const panel = getOrCreateHoverPanel(wrap);
    const catTotal = catData.total;
    const catPct = treemapTotal > 0 ? Math.round((catTotal / treemapTotal) * 100) : 0;
    const subs = (catData.subcategories || []).slice(0, 12);

    const subsHtml = subs.length
        ? subs
              .map((sub) => {
                  const pct = catTotal > 0 ? Math.round((sub.total / catTotal) * 100) : 0;
                  const barW = Math.max(3, pct);
                  return `
              <div class="stm-row">
                  <div class="stm-bar-wrap">
                      <div class="stm-bar" style="width:${barW}%;background:${color}"></div>
                  </div>
                  <span class="stm-sub-name">${esc(sub.name)}</span>
                  <span class="stm-sub-val">${esc(formatCurrency(sub.total, currency))}</span>
                  <span class="stm-sub-pct">${pct}%</span>
              </div>`;
              })
              .join('')
        : '<p class="stm-empty">Sem subcategorias neste período.</p>';

    panel.innerHTML = `
        <div class="stm-header" style="border-left:3px solid ${color}">
            <span class="stm-cat-name">${esc(catData.name)}</span>
            <span class="stm-cat-total">${esc(formatCurrency(catTotal, currency))}</span>
            <span class="stm-cat-pct">${catPct}% do período</span>
        </div>
        <div class="stm-subs">${subsHtml}</div>`;

    panel.classList.add('stm-hover-panel--visible');
    const pw = panel.offsetWidth || 260;
    const ph = panel.offsetHeight || 180;
    let left = caretX + 14;
    if (left + pw > chartW - 4) left = caretX - pw - 14;
    left = Math.max(4, left);
    let top = caretY - 20;
    top = Math.max(4, Math.min(top, chartH - ph - 4));

    panel.style.left = left + 'px';
    panel.style.top = top + 'px';
}

/**
 * @param {object} opts
 * @param {HTMLElement | null} opts.container — deve ter `id` único (ex.: `expenses-treemap`, `gains-treemap`).
 * @param {SpendingCategoryBlock[]} opts.displayCategories
 * @param {number} opts.mergedCount
 * @param {string} opts.currency
 * @param {(n: number, c: string) => string} opts.formatCurrency
 * @param {(s: string) => string} [opts.escapeHtml] — sanitiza painel de hover
 * @param {object} [opts.ui]
 * @param {string[]} [opts.ui.palette] — cores; padrão = saídas coloridas
 * @param {string} [opts.ui.canvasId]
 * @param {string} [opts.ui.ariaLabel]
 * @param {string} [opts.ui.emptyMessage]
 * @param {string} [opts.ui.chartErrorMessage]
 * @param {string} [opts.ui.datasetLabel]
 * @param {string} [opts.ui.demaisLabel] — texto da legenda de agrupamento no `title` da seção
 */
export function renderSpendingTreemapHost(opts) {
    const { container, displayCategories, mergedCount, currency, formatCurrency, escapeHtml } = opts;
    const ui = opts.ui || {};
    const palette = Array.isArray(ui.palette) && ui.palette.length ? ui.palette : CATEGORY_SOLID_COLORS;
    const canvasId = ui.canvasId || 'expenses-spending-treemap-canvas';
    const ariaLabel = ui.ariaLabel || 'Mapa por categoria';
    const emptyMessage = ui.emptyMessage || 'Nenhum dado no período selecionado.';
    const chartErrorMessage = ui.chartErrorMessage || 'Gráfico indisponível (Chart.js não carregado).';
    const datasetLabel = ui.datasetLabel || 'Por categoria';
    const demaisLabel = ui.demaisLabel || SPENDING_TREEMAP_DEMAIS_LABEL;

    if (!container) return;

    if (!container.id) {
        console.warn('renderSpendingTreemapHost: container precisa de id para gerir a instância do Chart.');
    }

    destroyTreemapChartForContainer(container);

    const treemapSection = container.closest('.treemap-container');
    if (treemapSection) {
        if (mergedCount > 0) {
            treemapSection.setAttribute('title', `+${mergedCount} categorias agrupadas em «${demaisLabel}»`);
        } else {
            treemapSection.removeAttribute('title');
        }
    }

    if (displayCategories.length === 0) {
        container.innerHTML = `<div class="treemap-empty">${escapePanelText(emptyMessage, escapeHtml)}</div>`;
        if (treemapSection) treemapSection.removeAttribute('title');
        return;
    }

    const treemapTree = buildSpendingTreemapTreeFromDisplayCategories(displayCategories);
    const treemapTotal = treemapTree.reduce((s, r) => s + r.value, 0);

    if (treemapTree.length === 0 || treemapTotal <= 0) {
        container.innerHTML = `<div class="treemap-empty">${escapePanelText(emptyMessage, escapeHtml)}</div>`;
        return;
    }

    const ChartCtor = typeof globalThis !== 'undefined' ? globalThis.Chart : null;
    if (!ChartCtor) {
        container.innerHTML = `<div class="treemap-empty">${escapePanelText(chartErrorMessage, escapeHtml)}</div>`;
        return;
    }

    const canvasSafeId = canvasId.replace(/[^a-zA-Z0-9_-]/g, '');
    container.innerHTML = `<div class="treemap-chartjs-wrap"><canvas id="${canvasSafeId}"></canvas></div>`;
    const wrap = container.querySelector('.treemap-chartjs-wrap');
    const canvas = document.getElementById(canvasSafeId);
    if (canvas) canvas.setAttribute('aria-label', ariaLabel);
    if (!canvas || !wrap) return;

    const groupIndex = new Map();
    displayCategories.forEach((c, i) => groupIndex.set(c.name, i));

    function solidColor(ctx) {
        if (ctx.type !== 'data') return 'transparent';
        const cat = ctx.raw?._data?.category ?? ctx.raw?.category;
        const idx = groupIndex.get(cat) ?? 0;
        return palette[idx % palette.length];
    }

    function externalTooltip({ chart, tooltip }) {
        if (!tooltip.opacity || !tooltip.dataPoints?.length) {
            hideHoverPanel(wrap);
            return;
        }
        const raw = tooltip.dataPoints[0]?.raw || {};
        const catName = raw?._data?.category ?? raw?.category;
        if (!catName) {
            hideHoverPanel(wrap);
            return;
        }

        const catData = displayCategories.find((c) => c.name === catName);
        if (!catData) {
            hideHoverPanel(wrap);
            return;
        }

        const idx = groupIndex.get(catName) ?? 0;
        const color = palette[idx % palette.length];

        renderHoverPanel({
            wrap,
            catData,
            color,
            treemapTotal,
            formatCurrency,
            currency,
            caretX: tooltip.caretX,
            caretY: tooltip.caretY,
            chartW: chart.width,
            chartH: chart.height,
            escapeHtml
        });
    }

    const chart = new ChartCtor(canvas, {
        type: 'treemap',
        data: {
            datasets: [
                {
                    label: datasetLabel,
                    tree: treemapTree,
                    key: 'value',
                    groups: ['category'],
                    spacing: 2.5,
                    borderRadius: 10,
                    borderWidth: 0,
                    borderColor: 'transparent',
                    backgroundColor: solidColor,
                    hoverBackgroundColor: (ctx) => {
                        if (ctx.type !== 'data') return 'transparent';
                        return lightenHex(solidColor(ctx));
                    },
                    captions: {
                        display: false
                    },
                    labels: {
                        display: true,
                        align: 'left',
                        position: 'top',
                        overflow: 'fit',
                        color: ['#ffffff', 'rgba(255,255,255,0.88)'],
                        hoverColor: '#ffffff',
                        font: [
                            { size: 14, weight: '700', lineHeight: 1.25 },
                            { size: 11, weight: '600', lineHeight: 1.25 }
                        ],
                        padding: 12,
                        formatter(ctx) {
                            if (ctx.type !== 'data') return '';
                            const r = ctx.raw || {};
                            const d = r._data || r;
                            const name = d.category != null ? String(d.category).trim() : '';
                            const val = r.v ?? d.value ?? r.value;
                            if (val == null) return name || '';
                            const pct = treemapTotal > 0 ? Math.round((Number(val) / treemapTotal) * 100) : 0;
                            const line2 = `${formatCurrency(Number(val), currency)} (${pct}%)`;
                            return name ? [name, line2] : line2;
                        }
                    }
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'nearest', intersect: true },
            elements: {
                treemap: {
                    borderRadius: 10
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    enabled: false,
                    external: externalTooltip
                }
            }
        }
    });

    if (container.id) treemapChartByContainerId.set(container.id, chart);

    canvas.onmouseleave = () => hideHoverPanel(wrap);
}
