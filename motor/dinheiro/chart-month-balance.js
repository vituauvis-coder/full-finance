import { enumerateCalendarMonths } from './calendar-month.js';
import { sumProjectedGainsForCalendarMonth } from './projected-gains.js';
import { sumOutflowsProjectedForCalendarMonth } from './projected-outflows.js';

/**
 * Saldo em conta no fim do mês civil — mesma regra do legado `dashboardBalanceAtEndOfChartMonth`.
 * `fetchBalance(start, end)` deve retornar número ou null (ex.: API).
 */
export async function balanceAtEndOfChartMonth(
    mo,
    now,
    fetchBalance,
    userGains,
    userExpenses,
    userAccounts,
    userProfile,
    splitRequests
) {
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    if (mo.end <= endOfToday) {
        return fetchBalance(mo.start, mo.end);
    }
    const baseBal = await fetchBalance(new Date(now.getFullYear(), now.getMonth(), 1), endOfToday);
    if (baseBal == null) return null;
    let projected = baseBal;
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    if (mo.end >= nextMonthStart) {
        for (const m2 of enumerateCalendarMonths(nextMonthStart, mo.end)) {
            const inc = sumProjectedGainsForCalendarMonth(m2, userGains);
            const outMo = sumOutflowsProjectedForCalendarMonth(
                m2,
                userExpenses,
                userAccounts,
                now,
                userProfile,
                splitRequests
            );
            projected += inc - outMo;
        }
    }
    return projected;
}

export async function fetchYearChartBalanceSeries(
    civilYear,
    now,
    fetchBalance,
    userGains,
    userExpenses,
    userAccounts,
    userProfile,
    splitRequests
) {
    const start = new Date(civilYear, 0, 1);
    const end = new Date(civilYear, 11, 31, 23, 59, 59, 999);
    const months = enumerateCalendarMonths(start, end);
    return Promise.all(
        months.map((mo) =>
            balanceAtEndOfChartMonth(
                mo,
                now,
                fetchBalance,
                userGains,
                userExpenses,
                userAccounts,
                userProfile,
                splitRequests
            )
        )
    );
}