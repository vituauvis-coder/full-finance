import { formatBRL } from './format';
import type { CategoryBlock } from './treemapData';
function treemapRawCategory(raw: Record<string, unknown> | undefined): string {
    if (!raw) return '';
    const nested = raw._data as { category?: string } | undefined;
    const fromNested = nested?.category;
    if (fromNested != null && String(fromNested).trim()) return String(fromNested).trim();
    const top = raw.category;
    if (top != null && String(top).trim()) return String(top).trim();
    return '';
}

export const TREEMAP_LABEL_FONT =
    'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

export function lightenTreemapHex(hex: string): string {
    if (!hex || !hex.startsWith('#') || hex.length !== 7) return hex;
    const n = parseInt(hex.slice(1), 16);
    const ch = (shift: number) => (n >> shift) & 0xff;
    const mix = (shift: number) => Math.min(255, Math.round(ch(shift) + (255 - ch(shift)) * 0.18));
    return `rgb(${mix(16)},${mix(8)},${mix(0)})`;
}

function escapeHtml(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function getOrCreateHoverPanel(wrap: HTMLElement): HTMLElement {
    let el = wrap.querySelector<HTMLElement>('.stm-hover-panel');
    if (!el) {
        el = document.createElement('div');
        el.className = 'stm-hover-panel treemap-hover-panel';
        el.setAttribute('aria-hidden', 'true');
        wrap.appendChild(el);
    }
    return el;
}

export function hideTreemapHoverPanel(wrap: HTMLElement | null | undefined) {
    if (!wrap) return;
    wrap.querySelector('.stm-hover-panel')?.classList.remove('stm-hover-panel--visible');
}

type HoverPanelOpts = {
    wrap: HTMLElement;
    catData: CategoryBlock;
    color: string;
    treemapTotal: number;
    currency: string;
    caretX: number;
    caretY: number;
    chartW: number;
    chartH: number;
};

function renderHoverPanel(opts: HoverPanelOpts) {
    const { wrap, catData, color, treemapTotal, currency, caretX, caretY, chartW, chartH } = opts;
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
                      <div class="stm-bar" style="width:${barW}%;background:${escapeHtml(color)}"></div>
                  </div>
                  <span class="stm-sub-name">${escapeHtml(sub.name)}</span>
                  <span class="stm-sub-val">${escapeHtml(formatBRL(sub.total, currency))}</span>
                  <span class="stm-sub-pct">${pct}%</span>
              </div>`;
              })
              .join('')
        : '<p class="stm-empty">Sem subcategorias neste período.</p>';

    panel.innerHTML = `
        <div class="stm-header" style="border-left:3px solid ${escapeHtml(color)}">
            <span class="stm-cat-name">${escapeHtml(catData.name)}</span>
            <span class="stm-cat-total">${escapeHtml(formatBRL(catTotal, currency))}</span>
            <span class="stm-cat-pct">${catPct}% do período</span>
        </div>
        <div class="stm-subs">${subsHtml}</div>`;

    panel.classList.add('stm-hover-panel--visible');
    const pw = panel.offsetWidth || 268;
    const ph = panel.offsetHeight || 180;
    let left = caretX + 16;
    if (left + pw > chartW - 6) left = caretX - pw - 16;
    left = Math.max(6, left);
    let top = caretY - 24;
    top = Math.max(6, Math.min(top, chartH - ph - 6));

    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
}

export type TreemapHoverContext = {
    wrap: HTMLElement | null;
    blocksByName: Map<string, CategoryBlock>;
    groupIndex: Map<string, number>;
    palette: string[];
    treemapTotal: number;
    currency: string;
};

/** Tooltip externo Chart.js — painel com subcategorias. */
export function handleTreemapExternalTooltip(
    context: { chart: { width: number; height: number }; tooltip: { opacity: number; caretX: number; caretY: number; dataPoints?: { raw?: Record<string, unknown> }[] } },
    ctx: TreemapHoverContext
) {
    const { chart, tooltip } = context;
    const wrap = ctx.wrap;
    if (!wrap || !tooltip.opacity || !tooltip.dataPoints?.length) {
        hideTreemapHoverPanel(wrap);
        return;
    }

    const raw = tooltip.dataPoints[0]?.raw ?? {};
    const catName = treemapRawCategory(raw);
    if (!catName) {
        hideTreemapHoverPanel(wrap);
        return;
    }

    const catData = ctx.blocksByName.get(catName);
    if (!catData) {
        hideTreemapHoverPanel(wrap);
        return;
    }

    const idx = ctx.groupIndex.get(catName) ?? 0;
    const color = ctx.palette[idx % ctx.palette.length] ?? '#64748b';

    renderHoverPanel({
        wrap,
        catData,
        color,
        treemapTotal: ctx.treemapTotal,
        currency: ctx.currency,
        caretX: tooltip.caretX,
        caretY: tooltip.caretY,
        chartW: chart.width,
        chartH: chart.height
    });
}