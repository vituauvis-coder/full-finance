import { formatHeatmapMonthLabel } from './cash-heatmap-aggregations.js';
import { formatCurrency } from '../../core/utils.js';

function itemIcon(it) {
    if (it.kind === 'gain') return 'fa-arrow-up';
    if (it.kind === 'invoice') return 'fa-file-invoice-dollar';
    if (it.pending) return 'fa-clock';
    return 'fa-arrow-down';
}

function itemTone(it) {
    if (it.kind === 'gain') return 'gain';
    if (it.kind === 'invoice') return 'invoice';
    if (it.pending) return 'pending';
    return 'expense';
}

export function renderCashHeatmapDayPanel(root, { year, monthIndex, selectedDay, items, userCurrency }) {
    if (!root) return;
    const monthLabel = formatHeatmapMonthLabel(year, monthIndex);
    const monthName = monthLabel.split(' ')[0];
    const dateTitle = `${selectedDay} de ${monthName} <span class="cash-heatmap-day-panel__year">${year}</span>`;

    const listHtml =
        items.length === 0
            ? `<div class="cash-heatmap-day-panel__empty"><i class="fas fa-circle-info" aria-hidden="true"></i><p>O mapa está limpo.<br>Sem movimentações nem faturas neste dia.</p></div>`
            : `<ul class="cash-heatmap-day-panel__list">${items
                  .map((it) => {
                      const tone = itemTone(it);
                      return `<li class="cash-heatmap-day-item cash-heatmap-day-item--compact">
                        <span class="cash-heatmap-day-item__icon cash-heatmap-day-item__icon--${tone}" aria-hidden="true"><i class="fas ${itemIcon(it)}"></i></span>
                        <div class="cash-heatmap-day-item__body">
                          <span class="cash-heatmap-day-item__title"></span>
                          <span class="cash-heatmap-day-item__meta"></span>
                        </div>
                        <span class="cash-heatmap-day-item__amount"></span>
                      </li>`;
                  })
                  .join('')}</ul>`;

    root.innerHTML = `
        <p class="cash-heatmap-day-panel__label">Detalhes do dia</p>
        <h3 class="cash-heatmap-day-panel__date">${dateTitle}</h3>
        ${listHtml}`;

    const lis = root.querySelectorAll('.cash-heatmap-day-item');
    items.forEach((it, i) => {
        const li = lis[i];
        if (!li) return;
        li.querySelector('.cash-heatmap-day-item__title').textContent = it.title;
        const meta = [it.bank, it.tag].filter(Boolean).join(' · ');
        li.querySelector('.cash-heatmap-day-item__meta').textContent = meta;
        const sign = it.kind === 'gain' ? '+' : it.kind === 'invoice' ? '' : '−';
        const prefix = sign ? `${sign} ` : '';
        li.querySelector('.cash-heatmap-day-item__amount').textContent = `${prefix}${formatCurrency(
            it.amount,
            userCurrency
        )}`;
        li.querySelector('.cash-heatmap-day-item__amount').classList.add(
            `cash-heatmap-day-item__amount--${itemTone(it)}`
        );
    });
}
