import { enumerateCalendarMonths } from './calendar-month.js';
import { sumProjectedGainsForCalendarMonth } from './projected-gains.js';
import { sumOutflowsProjectedForCalendarMonth } from './projected-outflows.js';

export function projectedCashBalanceAfterFuturePeriod(
    baseBalance,
    fromD,
    toD,
    now,
    accounts,
    expenses,
    gains,
    userProfile,
    splitRequests = null
) {
    const months = enumerateCalendarMonths(fromD, toD);
    let bal = Number(baseBalance) || 0;
    for (const mo of months) {
        const inc = sumProjectedGainsForCalendarMonth(mo, gains);
        const out = sumOutflowsProjectedForCalendarMonth(
            mo,
            expenses,
            accounts,
            now,
            userProfile,
            splitRequests
        );
        bal += inc - out;
    }
    return bal;
}