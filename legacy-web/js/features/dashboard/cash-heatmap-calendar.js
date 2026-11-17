import { formatHeatmapMonthLabel } from './cash-heatmap-aggregations.js';
import { formatCurrency } from '../../core/utils.js';

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

/** Vermelho só se saídas > entradas; verde se entradas > saídas. */
function heatmapToneClass(agg) {
    const entrada = agg.totalEntrada || 0;
    const saida = agg.totalSaida || 0;
    if (entrada === 0 && saida === 0) return 'cash-heatmap-day-btn--empty';
    if (saida > entrada) {
        if (agg.nivelSaida >= 3) return 'cash-heatmap-day-btn--out-heavy';
        if (agg.nivelSaida >= 2) return 'cash-heatmap-day-btn--out-mid';
        return 'cash-heatmap-day-btn--out-light';
    }
    if (entrada > saida) return 'cash-heatmap-day-btn--in';
    return 'cash-heatmap-day-btn--empty';
}

function cellClass(agg) {
    return heatmapToneClass(agg);
}

function dayTooltip(agg, userCurrency) {
    const parts = [];
    if (agg.totalEntrada > 0) {
        parts.push(`Entrada ${formatCurrency(agg.totalEntrada, userCurrency)}`);
    }
    if (agg.totalSaida > 0) {
        parts.push(`Saída ${formatCurrency(agg.totalSaida, userCurrency)}`);
    }
    for (const inv of agg.faturas || []) {
        parts.push(`Fatura ${inv.cardName}: ${formatCurrency(inv.amount, userCurrency)}`);
    }
    return parts.length ? parts.join(' · ') : 'Sem movimentações';
}

function renderMutedDay(num) {
    return `<span class="cash-heatmap-day-btn cash-heatmap-day-btn--muted" aria-hidden="true"><span class="cash-heatmap-day-btn__num">${num}</span></span>`;
}

export function renderCashHeatmapCalendar(
    root,
    { year, monthIndex, dayMap, selectedDay, userCurrency },
    onSelectDay
) {
    if (!root) return;
    const firstDow = new Date(year, monthIndex, 1).getDay();
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const prevMonthDays = new Date(year, monthIndex, 0).getDate();
    const label = formatHeatmapMonthLabel(year, monthIndex);

    let cells = '';
    for (let i = 0; i < firstDow; i++) {
        const num = prevMonthDays - firstDow + i + 1;
        cells += renderMutedDay(num);
    }
    for (let day = 1; day <= daysInMonth; day++) {
        const agg = dayMap.get(day) || {
            totalSaida: 0,
            totalEntrada: 0,
            temFatura: false,
            faturas: []
        };
        const pressed = day === selectedDay;
        const tip = dayTooltip(agg, userCurrency);
        cells += `<button type="button" class="cash-heatmap-day-btn ${cellClass(agg)}"
            data-day="${day}" aria-pressed="${pressed}" aria-label="Dia ${day}, ${tip}"
            title="${tip}">
            <span class="cash-heatmap-day-btn__num">${day}</span>
            ${agg.temFatura ? '<span class="cash-heatmap-day-btn__dot" title="Vencimento de fatura"></span>' : ''}
        </button>`;
    }
    const totalSlots = Math.ceil((firstDow + daysInMonth) / 7) * 7;
    const trailing = totalSlots - firstDow - daysInMonth;
    for (let i = 1; i <= trailing; i++) {
        cells += renderMutedDay(i);
    }

    root.innerHTML = `
        <header class="cash-heatmap-calendar__header">
            <div>
                <h3 class="cash-heatmap-calendar__title"><i class="fas fa-calendar-days" aria-hidden="true"></i> Heatmap de Caixa</h3>
                <p class="cash-heatmap-calendar__subtitle">Verde quando entradas superam saídas; vermelho quando saídas superam entradas (intensidade pelo volume).</p>
            </div>
            <div class="cash-heatmap-calendar__month-badge"><i class="fas fa-calendar" aria-hidden="true"></i> ${label}</div>
        </header>
        <div class="cash-heatmap-calendar__weekdays" aria-hidden="true">${WEEKDAYS.map((d) => `<span class="cash-heatmap-calendar__weekday">${d}</span>`).join('')}</div>
        <div class="cash-heatmap-calendar__grid" role="grid" aria-label="Calendário ${label}">${cells}</div>
        <footer class="cash-heatmap-calendar__legend" aria-hidden="true">
            <span>Saldo do dia:</span>
            <span><span class="cash-heatmap-legend-swatch cash-heatmap-day-btn--empty"></span> Neutro</span>
            <span><span class="cash-heatmap-legend-swatch cash-heatmap-day-btn--in"></span> Entradas &gt; saídas</span>
            <span><span class="cash-heatmap-legend-swatch cash-heatmap-day-btn--out-light"></span> Saídas &gt; entradas (leve)</span>
            <span><span class="cash-heatmap-legend-swatch cash-heatmap-day-btn--out-mid"></span> Médio</span>
            <span><span class="cash-heatmap-legend-swatch cash-heatmap-day-btn--out-heavy"></span> Forte</span>
            <span><span class="cash-heatmap-legend-swatch cash-heatmap-legend-swatch--dot"></span> Vencimento fatura</span>
        </footer>`;

    root.querySelectorAll('.cash-heatmap-day-btn[data-day]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const d = parseInt(btn.dataset.day, 10);
            if (Number.isFinite(d)) onSelectDay(d);
        });
    });
}
