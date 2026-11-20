import { dayKey, parseDayKey, startOfDayInLifeOS } from '@motor/viagens/calendar-format.js';

export const WEEK_SHORT_PT = ['DOM.', 'SEG.', 'TER.', 'QUA.', 'QUI.', 'SEX.', 'SÁB.'] as const;

const LIFEOS_TZ = 'America/Sao_Paulo';

export function dayKeyToYmd(key: string): { year: number; month: number; day: number } | null {
    const k = key.trim().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(k)) return null;
    const [year, month, day] = k.split('-').map(Number);
    if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null;
    return { year, month: month - 1, day };
}

export function toDayKey(year: number, month: number, day: number): string {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function weekdayIndexLifeOS(year: number, month: number): number {
    const first = parseDayKey(toDayKey(year, month, 1));
    if (!first) return 0;
    const name = new Intl.DateTimeFormat('en-US', { timeZone: LIFEOS_TZ, weekday: 'short' }).format(first);
    const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    return map[name] ?? 0;
}

const MONTH_LENGTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

function isLeapYear(year: number): boolean {
    return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInMonthLifeOS(year: number, month: number): number {
    if (month === 1) return isLeapYear(year) ? 29 : 28;
    return MONTH_LENGTH[month] ?? 30;
}

export function monthCellsLifeOS(year: number, month: number): Array<{ key: string | null; day: number | null }> {
    const pad = weekdayIndexLifeOS(year, month);
    const daysInMonth = daysInMonthLifeOS(year, month);
    const cells: Array<{ key: string | null; day: number | null }> = [];
    for (let i = 0; i < pad; i++) cells.push({ key: null, day: null });
    for (let d = 1; d <= daysInMonth; d++) {
        cells.push({ key: toDayKey(year, month, d), day: d });
    }
    return cells;
}

export function cursorFromDayKey(key: string): { year: number; month: number } {
    const parts = dayKeyToYmd(key);
    if (parts) return { year: parts.year, month: parts.month };
    const t = dayKeyToYmd(todayKey());
    return t ? { year: t.year, month: t.month } : { year: new Date().getFullYear(), month: new Date().getMonth() };
}

/** Soma dias em chave civil YYYY-MM-DD (sem bug de fuso do Date UTC). */
export function addDayKey(key: string, offset: number): string | null {
    const parts = dayKeyToYmd(key);
    if (!parts) return null;
    const t = Date.UTC(parts.year, parts.month, parts.day + offset);
    const d = new Date(t);
    return toDayKey(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

export function coerceDayKey(raw: string): string | null {
    const k = raw.trim().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(k)) return null;
    return parseDayKey(k) ? k : null;
}

export function toDateKeyLocal(year: number, monthIndex: number, day: number): string {
    return dayKey(new Date(year, monthIndex, day));
}

export function inTripRange(key: string, start: string, end: string): boolean {
    if (!start || !end) return false;
    return key >= start && key <= end;
}

export function formatTripDayShort(isoKey: string): string {
    const k = isoKey.trim().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(k)) return '—';
    const [year, month, day] = k.split('-').map(Number);
    const label = new Date(Date.UTC(year, month - 1, day, 12, 0, 0)).toLocaleDateString('pt-BR', {
        day: 'numeric',
        month: 'short',
        timeZone: 'America/Sao_Paulo'
    });
    return label.replace(/\sde\s/g, ' ').replace(/\./g, '').trim();
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
    let month = monthIndex + delta;
    let y = year;
    while (month < 0) {
        month += 12;
        y -= 1;
    }
    while (month > 11) {
        month -= 12;
        y += 1;
    }
    return { year: y, month };
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