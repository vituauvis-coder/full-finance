import { dayKey, parseDayKey, startOfDayInLifeOS } from '@motor/viagens/calendar-format.js';

export const WEEK_SHORT_PT = ['DOM.', 'SEG.', 'TER.', 'QUA.', 'QUI.', 'SEX.', 'SÁB.'] as const;

const LIFEOS_TZ = 'America/Sao_Paulo';

export const MONTH_SHORT_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'] as const;

export const MONTH_NAMES_PT = Array.from({ length: 12 }, (_, monthIndex) => {
    const raw = new Date(2024, monthIndex, 1).toLocaleDateString('pt-BR', { month: 'long', timeZone: LIFEOS_TZ });
    return raw.charAt(0).toUpperCase() + raw.slice(1);
});

/** Anos do seletor (desc); respeita min/max em ISO quando informados. */
export function yearOptionsForPicker(min?: string, max?: string): number[] {
    const now = new Date().getFullYear();
    const parsedMin = min && /^\d{4}/.test(min) ? parseInt(min.slice(0, 4), 10) : 1920;
    const parsedMax = max && /^\d{4}/.test(max) ? parseInt(max.slice(0, 4), 10) : now + 5;
    const yMin = Math.min(parsedMin, parsedMax);
    const yMax = Math.max(parsedMin, parsedMax);
    const out: number[] = [];
    for (let y = yMax; y >= yMin; y--) out.push(y);
    return out;
}

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

/** Grade fixa de 6 semanas — popover de data não muda de altura entre meses. */
export const CALENDAR_GRID_SLOT_COUNT = 42;

export function monthGridCellsLifeOS(
    year: number,
    month: number
): Array<{ key: string | null; day: number | null }> {
    const cells = monthCellsLifeOS(year, month);
    while (cells.length < CALENDAR_GRID_SLOT_COUNT) {
        cells.push({ key: null, day: null });
    }
    return cells.slice(0, CALENDAR_GRID_SLOT_COUNT);
}

export function cursorFromDayKey(key: string): { year: number; month: number } {
    const parts = dayKeyToYmd(key);
    if (parts) return { year: parts.year, month: parts.month };
    const t = dayKeyToYmd(todayKey());
    return t ? { year: t.year, month: t.month } : { year: new Date().getFullYear(), month: new Date().getMonth() };
}

export function coerceDayKey(raw: string): string | null {
    const k = raw.trim().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(k)) return null;
    return parseDayKey(k) ? k : null;
}

export function formatDateLabelPt(isoKey: string): string {
    const k = isoKey.trim().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(k)) return '—';
    const [year, month, day] = k.split('-').map(Number);
    const label = new Date(Date.UTC(year, month - 1, day, 12, 0, 0)).toLocaleDateString('pt-BR', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: LIFEOS_TZ
    });
    return label.replace(/\sde\s/g, ' ').replace(/\./g, '').trim();
}

/** Mantém alias usado em viagens */
export const formatTripDayShort = formatDateLabelPt;

export function monthTitlePt(year: number, monthIndex: number): string {
    const raw = new Date(year, monthIndex, 1).toLocaleDateString('pt-BR', {
        month: 'long',
        year: 'numeric',
        timeZone: LIFEOS_TZ
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

export function isDayKeyInRange(key: string, min?: string, max?: string): boolean {
    if (min && key < min.slice(0, 10)) return false;
    if (max && key > max.slice(0, 10)) return false;
    return true;
}