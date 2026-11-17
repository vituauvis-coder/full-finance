import { filterMovementsInPeriod, type ListFilter } from '../../../lib/movementList';

export function isSingleMonthPeriod(period: string): boolean {
    return /^month-\d+$/.test(period || '');
}

export function previousCivilMonth(
    period: string,
    civilYear: number
): { period: string; year: number } | null {
    const m = /^month-(\d+)$/.exec(period || '');
    if (!m) return null;
    let mi = parseInt(m[1], 10);
    let y = civilYear;
    if (mi === 0) {
        mi = 11;
        y -= 1;
    } else {
        mi -= 1;
    }
    return { period: `month-${mi}`, year: y };
}

/** Mesmos filtros da lista, mas datas do drawer não cortam o mês civil (comparativo MoM). */
export function listFilterForMomCompare(filter: ListFilter): ListFilter {
    const { dateFrom: _df, dateTo: _dt, ...rest } = filter;
    return rest;
}