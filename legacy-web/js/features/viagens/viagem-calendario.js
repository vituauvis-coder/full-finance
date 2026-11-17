import { parseDayKey } from '../../../../motor/viagens/calendar-format.js';

const WEEK = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

function toDateKey(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function inRange(key, start, end) {
    if (!start || !end) return false;
    return key >= start && key <= end;
}

export function renderTripCalendarCard(draft) {
    const start = draft.startsOn?.trim() || '';
    const end = draft.endsOn?.trim() || '';
    const anchor = parseDayKey(start) ?? new Date();
    const year = anchor.getFullYear();
    const month = anchor.getMonth();
    const title = anchor.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

    const first = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0).getDate();
    const pad = first.getDay();
    let cells = '';
    for (let i = 0; i < pad; i++) {
        cells += '<span class="viagens-cal__day viagens-cal__day--empty"></span>';
    }
    for (let d = 1; d <= lastDay; d++) {
        const key = toDateKey(new Date(year, month, d));
        const classes = ['viagens-cal__day'];
        if (inRange(key, start, end)) classes.push('viagens-cal__day--in-range');
        if (key === start) classes.push('viagens-cal__day--start');
        if (key === end) classes.push('viagens-cal__day--end');
        cells += `<span class="${classes.join(' ')}" data-day="${d}">${d}</span>`;
    }

    return `
        <article class="viagens-panel viagens-panel--cal" aria-label="Calendário">
            <header class="viagens-panel__head">
                <h3 class="viagens-panel__title">${title}</h3>
            </header>
            <div class="viagens-cal__dates">
                <label class="viagens-cal__field">
                    <span>Início</span>
                    <input type="date" class="viagens-field" data-field-starts value="${start}">
                </label>
                <label class="viagens-cal__field">
                    <span>Fim</span>
                    <input type="date" class="viagens-field" data-field-ends value="${end}">
                </label>
            </div>
            <div class="viagens-cal__week">${WEEK.map((w) => `<span>${w}</span>`).join('')}</div>
            <div class="viagens-cal__grid">${cells}</div>
        </article>`;
}