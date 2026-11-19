import { dayKey, parseDayKey, startOfDayInLifeOS } from '@motor/viagens/calendar-format.js';

export const WEEK_SHORT_PT = ['DOM.', 'SEG.', 'TER.', 'QUA.', 'QUI.', 'SEX.', 'SÁB.'] as const;

export function toDateKeyLocal(year: number, monthIndex: number, day: number): string {
    return dayKey(new Date(year, monthIndex, day));
}

export function inTripRange(key: string, start: string, end: string): boolean {
    if (!start || !end) return false;
    return key >= start && key <= end;
}

export function formatTripDayShort(isoKey: string): string {
    const d = parseDayKey(isoKey);
    if (!d) return '—';
    return d
        .toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', timeZone: 'America/Sao_Paulo' })
        .replace(/\sde\s/g, ' ')
        .replace(/\./g, '')
        .trim();
}

export function monthTitlePt(year: number, monthIndex: number): string {
    const raw = new Date(year, monthIndex, 1).toLocaleDateString('pt-BR', {
        month: 'long',
        year: 'numeric',
        timeZone: 'America/Sao_Paulo'
    });
    return raw.charAt(0).toUpperCase() + raw.slice(1);
}

export function todayKey(): string {
    return dayKey(startOfDayInLifeOS(new Date()));
}

export function shiftMonth(year: number, monthIndex: number, delta: number): { year: number; month: number } {
    const d = new Date(year, monthIndex + delta, 1);
    return { year: d.getFullYear(), month: d.getMonth() };
}

export function anchorMonth(startsOn: string, endsOn: string): { year: number; month: number } {
    const key = startsOn.trim() || endsOn.trim();
    const parsed = key ? parseDayKey(key) : startOfDayInLifeOS(new Date());
    return { year: parsed.getFullYear(), month: parsed.getMonth() };
}

/** Clique no grid: define início/fim da viagem. */
export function applyRangeDayClick(
    key: string,
    start: string,
    end: string
): { startsOn: string; endsOn: string } {
    if (!start || (start && end)) {
        return { startsOn: key, endsOn: '' };
    }
    if (key < start) {
        return { startsOn: key, endsOn: start };
    }
    return { startsOn: start, endsOn: key };
}