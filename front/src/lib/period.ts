export const MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export function defaultPeriod(now = new Date()) {
    return `month-${now.getMonth()}`;
}

export function defaultCivilYear(now = new Date()) {
    return now.getFullYear();
}

export function periodFromMonthIndex(monthIndex: number) {
    const mi = Math.min(11, Math.max(0, monthIndex));
    return `month-${mi}`;
}

export function monthIndexFromPeriod(period: string, fallback = new Date().getMonth()) {
    const m = /^month-(\d+)$/.exec(period || '');
    if (!m) return fallback;
    return Math.min(11, Math.max(0, parseInt(m[1], 10)));
}

export function getPeriodDateBounds(period: string, civilYear: number, now = new Date()) {
    const monthMatch = /^month-(\d+)$/.exec(period || '');
    if (monthMatch) {
        const mi = Math.min(11, Math.max(0, parseInt(monthMatch[1], 10)));
        const y = civilYear;
        const startDate = new Date(y, mi, 1);
        const endDate = new Date(y, mi + 1, 0, 23, 59, 59, 999);
        return { startDate, endDate };
    }
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    return { startDate, endDate };
}

export function movementDate(m: { date?: string | { seconds?: number } }): Date {
    const d = m.date;
    if (d == null) return new Date(NaN);
    if (typeof d === 'object' && d.seconds != null) return new Date(d.seconds * 1000);
    return new Date(d as string);
}