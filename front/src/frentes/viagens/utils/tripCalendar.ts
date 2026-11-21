import { dayKey, parseDayKey, startOfDayInLifeOS } from '@motor/viagens/calendar-format.js';

import { dayKeyToYmd, toDayKey } from '../../../lib/calendarUi';

export {
    WEEK_SHORT_PT,
    dayKeyToYmd,
    toDayKey,
    monthCellsLifeOS,
    cursorFromDayKey,
    coerceDayKey,
    formatTripDayShort,
    formatDateLabelPt,
    monthTitlePt,
    todayKey,
    shiftMonth,
    isDayKeyInRange
} from '../../../lib/calendarUi';

/** Soma dias em chave civil YYYY-MM-DD (sem bug de fuso do Date UTC). */
export function addDayKey(key: string, offset: number): string | null {
    const parts = dayKeyToYmd(key);
    if (!parts) return null;
    const t = Date.UTC(parts.year, parts.month, parts.day + offset);
    const d = new Date(t);
    return toDayKey(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

export function toDateKeyLocal(year: number, monthIndex: number, day: number): string {
    return dayKey(new Date(year, monthIndex, day));
}

export function inTripRange(key: string, start: string, end: string): boolean {
    if (!start || !end) return false;
    return key >= start && key <= end;
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