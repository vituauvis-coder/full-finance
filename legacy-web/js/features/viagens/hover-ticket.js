import { formatBRL } from './map-utils.js';

export function renderHoverTicketHtml(hover) {
    if (!hover) return '';
    return `
        <div class="viagens-ticket" role="tooltip">
            <h4>${escapeHtml(hover.placeName)}</h4>
            <p>${escapeHtml(hover.tripTitle)}</p>
            ${hover.monthYear ? `<p class="viagens-muted">${escapeHtml(hover.monthYear)}</p>` : ''}
            <p>nesta cidade ${formatBRL(hover.citySpent)}</p>
            <p>viagem ${formatBRL(hover.tripTotal)}</p>
        </div>`;
}

function escapeHtml(s) {
    return String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}