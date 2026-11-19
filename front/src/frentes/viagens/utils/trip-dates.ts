import { toApiDayKey } from '@motor/viagens/calendar-format.js';

const TZ = 'America/Sao_Paulo';

export function formatTripDayLabel(raw: string | null | undefined): string | null {
    const key = raw != null && raw !== '' ? toApiDayKey(raw) : null;
    if (!key) return null;
    const d = new Date(`${key}T12:00:00-03:00`);
    if (Number.isNaN(d.getTime())) return null;
    return d
        .toLocaleDateString('pt-BR', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            timeZone: TZ
        })
        .replace(/\./g, '');
}

/** Data no bilhete — DD/MM/AAAA (fuso LifeOS). */
export function formatTripTicketDay(raw: string | null | undefined): string | null {
    const key = raw != null && raw !== '' ? toApiDayKey(raw) : null;
    if (!key) return null;
    const [y, m, d] = key.split('-');
    if (!y || !m || !d) return null;
    return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
}

export function formatTripDateRange(startsOn: string | null | undefined, endsOn: string | null | undefined) {
    const start = formatTripDayLabel(startsOn);
    const end = formatTripDayLabel(endsOn);
    if (start && end) return `${start} – ${end}`;
    if (start) return start;
    if (end) return end;
    return 'Sem datas';
}