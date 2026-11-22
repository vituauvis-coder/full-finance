export const MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

/** Entradas/Saídas — mês civil selecionado no stepper (‹ ano ›). */
export const CIVIL_YEAR_PERIOD = 'civil-year';

/** Cofrinhos — histórico completo, sem recorte por ano. */
export const ALL_YEARS_PERIOD = 'all-years';

export function isCivilYearPeriod(period: string) {
    return period === CIVIL_YEAR_PERIOD;
}

export function isAllYearsPeriod(period: string) {
    return period === ALL_YEARS_PERIOD;
}

export function isMonthCivilPeriod(period: string) {
    return !isCivilYearPeriod(period) && !isAllYearsPeriod(period);
}

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

/** Mês usado na grade de instituições da Carteira quando o período é «ano inteiro». */
export function walletCatalogMonthIndex(period: string, civilYear: number, now = new Date()) {
    if (isCivilYearPeriod(period)) {
        return civilYear === now.getFullYear() ? now.getMonth() : 11;
    }
    const mi = monthIndexFromPeriod(period, now.getMonth());
    return mi < 0 ? now.getMonth() : mi;
}

export function monthIndexFromPeriod(period: string, fallback = new Date().getMonth()) {
    if (isCivilYearPeriod(period) || isAllYearsPeriod(period)) return -1;
    const m = /^month-(\d+)$/.exec(period || '');
    if (!m) return fallback;
    return Math.min(11, Math.max(0, parseInt(m[1], 10)));
}

export function getPeriodDateBounds(period: string, civilYear: number, now = new Date()) {
    if (isCivilYearPeriod(period)) {
        const startDate = new Date(civilYear, 0, 1);
        const endDate = new Date(civilYear, 11, 31, 23, 59, 59, 999);
        return { startDate, endDate };
    }
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