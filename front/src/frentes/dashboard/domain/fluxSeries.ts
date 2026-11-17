import { expenseMatchesDashboardFacet, gainMatchesDashboardFacet } from '../../../lib/dashboardExpenseFacets';
import { getPeriodDateBounds, movementDate, monthIndexFromPeriod, MONTH_NAMES } from '../../../lib/period';
import type { Account, DashboardFacets, Movement } from '../../../lib/types/finance';

export function buildYearFluxSeries(
    gains: Movement[],
    expenses: Movement[],
    civilYear: number,
    facets?: DashboardFacets,
    accounts?: Account[],
    expenseCategory?: string
) {
    const labels = MONTH_NAMES.map((m) => `${m}/${String(civilYear).slice(2)}`);
    const gainData: number[] = [];
    const expenseData: number[] = [];
    const netData: number[] = [];
    const accountById = new Map((accounts ?? []).map((a) => [a.id, a]));

    for (let mi = 0; mi < 12; mi++) {
        const period = `month-${mi}`;
        const { startDate, endDate } = getPeriodDateBounds(period, civilYear);
        let gSum = 0;
        let eSum = 0;
        for (const g of gains) {
            if (g.referenceOnly) continue;
            const d = movementDate(g);
            if (d < startDate || d > endDate) continue;
            if (facets && !gainMatchesDashboardFacet(g, facets.gains)) continue;
            gSum += Number(g.amount) || 0;
        }
        for (const e of expenses) {
            if (e.referenceOnly) continue;
            const d = movementDate(e);
            if (d < startDate || d > endDate) continue;
            if (expenseCategory && (e.category || '') !== expenseCategory) continue;
            if (facets && !expenseMatchesDashboardFacet(e, accountById.get(String(e.accountId)), facets.expenses)) {
                continue;
            }
            eSum += Number(e.amount) || 0;
        }
        gainData.push(gSum);
        expenseData.push(eSum);
        netData.push(gSum - eSum);
    }

    return { labels, gainData, expenseData, netData };
}

export function buildSelectedMonthDailySeries(
    gains: Movement[],
    expenses: Movement[],
    period: string,
    civilYear: number,
    facets?: DashboardFacets,
    accounts?: Account[],
    expenseCategory?: string
) {
    const mi = monthIndexFromPeriod(period);
    const { startDate, endDate } = getPeriodDateBounds(period, civilYear);
    const daysInMonth = new Date(civilYear, mi + 1, 0).getDate();
    const labels: string[] = [];
    const gainData: number[] = [];
    const expenseData: number[] = [];
    const accountById = new Map((accounts ?? []).map((a) => [a.id, a]));

    for (let day = 1; day <= daysInMonth; day++) {
        const dayStart = new Date(civilYear, mi, day, 0, 0, 0, 0);
        const dayEnd = new Date(civilYear, mi, day, 23, 59, 59, 999);
        if (dayStart < startDate || dayEnd > endDate) {
            labels.push(String(day));
            gainData.push(0);
            expenseData.push(0);
            continue;
        }
        labels.push(String(day));
        let gSum = 0;
        let eSum = 0;
        for (const g of gains) {
            const d = movementDate(g);
            if (d < dayStart || d > dayEnd) continue;
            if (facets && !gainMatchesDashboardFacet(g, facets.gains)) continue;
            gSum += Number(g.amount) || 0;
        }
        for (const e of expenses) {
            const d = movementDate(e);
            if (d < dayStart || d > dayEnd) continue;
            if (expenseCategory && (e.category || '') !== expenseCategory) continue;
            if (facets && !expenseMatchesDashboardFacet(e, accountById.get(String(e.accountId)), facets.expenses)) {
                continue;
            }
            eSum += Number(e.amount) || 0;
        }
        gainData.push(gSum);
        expenseData.push(eSum);
    }
    return { labels, gainData, expenseData, netData: gainData.map((g, i) => g - expenseData[i]) };
}