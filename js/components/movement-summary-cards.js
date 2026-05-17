import { MOVEMENT_SUMMARY_CARD_GROUPS, getSummaryCardTitleElementId } from '../core/movement-summary-copy.js';
import { syncPortalTooltip } from '../core/portal-tooltip.js';

function escapeHtml(text) {
    return String(text ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function escapeAttr(text) {
    return escapeHtml(text).replace(/'/g, '&#39;');
}

/**
 * @param {import('../core/movement-summary-copy.js').MOVEMENT_SUMMARY_CARD_GROUPS.expenses.cards[0]} card
 */
export function renderMovementSummaryCard(card) {
    const useTooltipIcon = card.iconTooltip !== false;
    const iconClasses = [
        'card-icon',
        card.tone,
        useTooltipIcon ? 'movements-summary-card-icon' : '',
        card.iconClass || ''
    ]
        .filter(Boolean)
        .join(' ');

    const tooltipAttr =
        useTooltipIcon && card.description
            ? ` data-portal-tooltip="${escapeAttr(card.description)}"`
            : '';

    const variationHtml = card.variationId
        ? `<span id="${escapeHtml(card.variationId)}" class="dashboard-card-scope"></span>`
        : '';

    const scopeHtml = card.scopeId
        ? `<span id="${escapeHtml(card.scopeId)}" class="dashboard-card-scope">${escapeHtml(card.scopeText || '')}</span>`
        : '';

    const hintHtml =
        card.hint != null
            ? `<span class="card-metric-hint"${card.hintId ? ` id="${escapeHtml(card.hintId)}"` : ''}>${escapeHtml(card.hint)}</span>`
            : '';

    const extraAfterValue = card.extraAfterValue || '';
    const titleId = card.titleId || `${card.id}-title`;
    const valueId = card.valueId || card.id;
    const iconAria = card.iconAriaHidden ? ' aria-hidden="true"' : '';

    return `<div class="card">
            <div class="${iconClasses}" id="${escapeHtml(card.id)}-icon"${tooltipAttr}${iconAria}><i class="fas ${escapeHtml(card.icon)}" aria-hidden="true"></i></div>
            <div class="card-content">
                <h3 id="${escapeHtml(titleId)}">${escapeHtml(card.title)}</h3>
                <p id="${escapeHtml(valueId)}">—</p>
                ${extraAfterValue}
                ${variationHtml}
                ${scopeHtml}
                ${hintHtml}
            </div>
        </div>`;
}

/**
 * Monta todos os grupos declarados em MOVEMENT_SUMMARY_CARD_GROUPS.
 * Containers: `[data-summary-group="expenses"]`, etc.
 */
export function mountMovementSummaryCards() {
    document.querySelectorAll('[data-summary-group]').forEach((container) => {
        const groupKey = container.dataset.summaryGroup;
        const group = MOVEMENT_SUMMARY_CARD_GROUPS[groupKey];
        if (!group) return;

        if (group.containerClass) {
            container.classList.add(group.containerClass);
        }
        container.setAttribute('aria-label', group.ariaLabel);
        container.innerHTML = group.cards.map((card) => renderMovementSummaryCard(card)).join('');

        for (const card of group.cards) {
            if (!card.description || card.iconTooltip === false) continue;
            const icon = document.getElementById(`${card.id}-icon`);
            if (icon) syncPortalTooltip(icon);
        }
    });
}

/**
 * Atualiza a descrição (tooltip) do ícone de um card pelo id base (sem sufixo -icon).
 * @param {string} cardId ex.: expenses-summary-month
 * @param {string|null|undefined} text
 */
export function setSummaryCardTooltip(cardId, text) {
    const icon = document.getElementById(`${cardId}-icon`);
    if (!icon) return;

    const trimmed = text?.trim() || '';
    if (trimmed) {
        icon.setAttribute('data-portal-tooltip', trimmed);
        icon.removeAttribute('title');
    } else {
        icon.removeAttribute('data-portal-tooltip');
        icon.removeAttribute('title');
    }
    syncPortalTooltip(icon);
}

/**
 * @param {string} cardId
 * @param {string} title
 */
export function setSummaryCardTitle(cardId, title) {
    const el = document.getElementById(getSummaryCardTitleElementId(cardId));
    if (el && title != null) el.textContent = title;
}
