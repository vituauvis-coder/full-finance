import { getPeriodDateBounds } from '../../../lib/period';

export function currentMonthPeriodBounds(now = new Date()) {
    const period = `month-${now.getMonth()}`;
    return getPeriodDateBounds(period, now.getFullYear(), now);
}