import { gainMatchesDashboardFacet } from '../../../lib/dashboardExpenseFacets';
import { getPeriodDateBounds, movementDate, monthIndexFromPeriod, MONTH_NAMES } from '../../../lib/period';
import type { Account, DashboardFacets, ExpenseSplitRequest, Movement } from '../../../lib/types/finance';
import {
    balancoFromFluxBreakdown,
    fluxBreakdownForCivilPeriod,
    fluxDailyBreakdownInMonth
} from './fluxExpenseBreakdown';

export type FluxSeriesPayload = {
    labels: string[];
    gainData: number[];
    expenseFixedData: number[];
    expenseInvoiceData: number[];
    expenseExtraData: number[];
    expenseCofrinhoData: number[];
    /** Total de saídas (fixas + faturas + extras + cofrinhos). */
    expenseData: number[];
    /** Entradas − (fixas + faturas), mesma regra do balanço da carteira. */
    netData: number[];
};

function sumGainsInRange(
    gains: Movement[],
    start: Date,
    end: Date,
    facets?: DashboardFacets
): number {
    let gSum = 0;
    for (const g of gains) {
        const d = movementDate(g);
        if (d < start || d > end) continue;
        if (facets && !gainMatchesDashboardFacet(g, facets.gains)) continue;
        gSum += Number(g.amount) || 0;
    }
    return gSum;
}

function pushExpenseBucket(
    payload: Omit<FluxSeriesPayload, 'labels'> & { labels?: never },
    entrada: number,
    breakdown: ReturnType<typeof fluxBreakdownForCivilPeriod>
) {
    payload.gainData.push(entrada);
    payload.expenseFixedData.push(breakdown.saidaFixa);
    payload.expenseInvoiceData.push(breakdown.saidaFatura);
    payload.expenseExtraData.push(breakdown.saidaExtra);
    payload.expenseCofrinhoData.push(breakdown.saidaCofrinho);
    const totalSaida =
        breakdown.saidaFixa + breakdown.saidaFatura + breakdown.saidaExtra + breakdown.saidaCofrinho;
    payload.expenseData.push(totalSaida);
    payload.netData.push(balancoFromFluxBreakdown(entrada, breakdown));
}

export function buildYearFluxSeries(
    gains: Movement[],
    expenses: Movement[],
    civilYear: number,
    facets: DashboardFacets | undefined,
    accounts: Account[],
    splitRequests: ExpenseSplitRequest[],
    expenseCategories?: ReadonlySet<string>
): FluxSeriesPayload {
    const labels = MONTH_NAMES.map((m) => `${m}/${String(civilYear).slice(2)}`);
    const payload = {
        labels,
        gainData: [] as number[],
        expenseFixedData: [] as number[],
        expenseInvoiceData: [] as number[],
        expenseExtraData: [] as number[],
        expenseCofrinhoData: [] as number[],
        expenseData: [] as number[],
        netData: [] as number[]
    };

    for (let mi = 0; mi < 12; mi++) {
        const period = `month-${mi}`;
        const { startDate, endDate } = getPeriodDateBounds(period, civilYear);
        const entrada = sumGainsInRange(gains, startDate, endDate, facets);
        const breakdown = fluxBreakdownForCivilPeriod(
            expenses,
            accounts,
            period,
            civilYear,
            splitRequests,
            expenseCategories
        );
        pushExpenseBucket(payload, entrada, breakdown);
    }

    return payload;
}

export function buildSelectedMonthDailySeries(
    gains: Movement[],
    expenses: Movement[],
    period: string,
    civilYear: number,
    facets: DashboardFacets | undefined,
    accounts: Account[],
    splitRequests: ExpenseSplitRequest[],
    expenseCategories?: ReadonlySet<string>
): FluxSeriesPayload {
    const mi = monthIndexFromPeriod(period);
    const { startDate, endDate } = getPeriodDateBounds(period, civilYear);
    const daysInMonth = new Date(civilYear, mi + 1, 0).getDate();
    const labels: string[] = [];
    const payload = {
        labels,
        gainData: [] as number[],
        expenseFixedData: [] as number[],
        expenseInvoiceData: [] as number[],
        expenseExtraData: [] as number[],
        expenseCofrinhoData: [] as number[],
        expenseData: [] as number[],
        netData: [] as number[]
    };
    const dailyBreakdown = fluxDailyBreakdownInMonth(
        expenses,
        accounts,
        period,
        civilYear,
        splitRequests,
        expenseCategories
    );

    for (let day = 1; day <= daysInMonth; day++) {
        const dayStart = new Date(civilYear, mi, day, 0, 0, 0, 0);
        const dayEnd = new Date(civilYear, mi, day, 23, 59, 59, 999);
        labels.push(String(day));
        const breakdown = dailyBreakdown[day - 1] ?? {
            saidaFixa: 0,
            saidaFatura: 0,
            saidaExtra: 0,
            saidaCofrinho: 0
        };
        if (dayStart < startDate || dayEnd > endDate) {
            pushExpenseBucket(payload, 0, {
                saidaFixa: 0,
                saidaFatura: 0,
                saidaExtra: 0,
                saidaCofrinho: 0
            });
            continue;
        }
        const entrada = sumGainsInRange(gains, dayStart, dayEnd, facets);
        pushExpenseBucket(payload, entrada, breakdown);
    }

    return { ...payload, labels };
}