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

/** Mês civil atual no filtro padrão (anel da coluna Parcelas). */
export function isExpenseInstallmentMonthRingMode(
    period: string,
    civilYear: number,
    now = new Date()
) {
    return (
        isMonthCivilPeriod(period) &&
        period === defaultPeriod(now) &&
        civilYear === defaultCivilYear(now)
    );
}

/** Período das pílulas de parcelas (null = contrato inteiro no ano / todos os anos). */
export function expenseInstallmentListPeriodForPills(period: string, bounds: {
    startDate: Date;
    endDate: Date;
}) {
    if (isCivilYearPeriod(period) || isAllYearsPeriod(period)) return null;
    return bounds;
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

export function toLocalDateInputValue(d: Date) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

/** Data inicial ao criar entrada/saída: hoje se cair no período visível, senão o 1º dia do recorte. */
export function defaultMovementFormDate(period: string, civilYear: number, now = new Date()) {
    if (isAllYearsPeriod(period)) return toLocalDateInputValue(now);
    const { startDate, endDate } = getPeriodDateBounds(period, civilYear, now);
    const t = now.getTime();
    if (t >= startDate.getTime() && t <= endDate.getTime()) return toLocalDateInputValue(now);
    return toLocalDateInputValue(startDate);
}