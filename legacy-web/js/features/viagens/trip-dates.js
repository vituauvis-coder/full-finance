import { toApiDayKey } from '../../../../motor/viagens/calendar-format.js';

function formatDayLabel(raw) {
    const key = raw != null && raw !== '' ? toApiDayKey(raw) : null;
    if (!key) return null;
    const d = new Date(`${key}T12:00:00-03:00`);
    if (Number.isNaN(d.getTime())) return null;
    return d
        .toLocaleDateString('pt-BR', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            timeZone: 'America/Sao_Paulo'
        })
        .replace(/\./g, '');
}

export function formatTripDateRange(startsOn, endsOn) {
    const start = formatDayLabel(startsOn);
    const end = formatDayLabel(endsOn);
    if (start && end) return `${start} – ${end}`;
    if (start) return start;
    if (end) return end;
    return 'Sem datas';
}