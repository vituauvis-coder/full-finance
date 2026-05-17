import { MOVEMENT_SUMMARY_VARIATION_COPY } from './movement-summary-copy.js';

/**
 * Comparativo % do valor principal do card (saídas/entradas/dashboard) vs mês civil anterior,
 * quando o filtro é um único mês (month-0 … month-11).
 * @param {boolean} invertExpenseSemantics - true = saídas (aumento pior = vermelho)
 */
export function setMovementSummaryMomVariation(
    el,
    totalPeriod,
    totalPrevMonth,
    isSingleMonth,
    invertExpenseSemantics
) {
    if (!el) return;
    if (!isSingleMonth) {
        el.innerHTML = `<span class="card-metric-hint" title="${escapeAttr(MOVEMENT_SUMMARY_VARIATION_COPY.needSingleMonth)}">—</span>`;
        return;
    }
    if (totalPrevMonth > 0) {
        const diff = ((totalPeriod - totalPrevMonth) / totalPrevMonth) * 100;
        const isIncrease = diff > 0;
        const icon = isIncrease ? '↑' : '↓';
        const isPositive = invertExpenseSemantics ? !isIncrease : isIncrease;
        const pctClass = isPositive ? 'positive' : 'negative';
        el.innerHTML = `<span class="summary-mom-pct ${pctClass}">${icon} ${Math.abs(diff).toFixed(1)}%</span> <span class="card-metric-hint" style="display:inline;" title="${escapeAttr(MOVEMENT_SUMMARY_VARIATION_COPY.vsPreviousMonthTitle)}">${MOVEMENT_SUMMARY_VARIATION_COPY.vsPreviousMonthLabel}</span>`;
        return;
    }
    if (totalPeriod > 0) {
        el.innerHTML = `<span class="card-metric-hint" title="${escapeAttr(MOVEMENT_SUMMARY_VARIATION_COPY.noPreviousBase)}">Sem base no mês anterior</span>`;
        return;
    }
    el.innerHTML = `<span class="card-metric-hint" title="${escapeAttr(MOVEMENT_SUMMARY_VARIATION_COPY.noValues)}">—</span>`;
}

function escapeAttr(text) {
    return String(text ?? '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/'/g, '&#39;');
}
