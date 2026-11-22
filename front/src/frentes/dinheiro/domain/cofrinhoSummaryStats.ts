import type { Movement } from '../../../lib/types/finance';
import { defaultCivilYear, defaultPeriod } from '../../../lib/period';
import {
    getTotalInBuckets,
    sumAllocatedInMonth,
    type CofrinhoApplication,
    type CofrinhoBucket
} from './cofrinhoAggregations';
import { yearMonthFromCivilPeriod } from './cofrinhoPeriod';
import { totalCofrinhoPoolPending } from './cofrinhoPending';

export type CofrinhoSummary = {
    totalInBuckets: number;
    monthAllocated: number;
    pending: number;
};

/** KPIs do hero — visão fixa: total geral, aporte do mês civil vigente, pool pendente (todos os meses). */
export function cofrinhoHeroSummary(
    buckets: CofrinhoBucket[],
    applications: CofrinhoApplication[],
    expenses: Movement[],
    now = new Date()
): CofrinhoSummary {
    const year = defaultCivilYear(now);
    const period = defaultPeriod(now);
    const yearMonth = yearMonthFromCivilPeriod(period, year, now);
    return {
        totalInBuckets: getTotalInBuckets(buckets, expenses, applications),
        monthAllocated: sumAllocatedInMonth(applications, buckets, yearMonth, expenses),
        pending: totalCofrinhoPoolPending(expenses)
    };
}