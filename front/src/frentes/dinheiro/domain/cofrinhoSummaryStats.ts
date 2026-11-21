import type { Movement } from '../../../lib/types/finance';
import {
    computePendingBalance,
    getTotalInBuckets,
    sumAllocatedInMonth,
    type CofrinhoApplication,
    type CofrinhoBucket
} from './cofrinhoAggregations';
import { yearMonthFromCivilPeriod } from './cofrinhoPeriod';

export type CofrinhoSummary = {
    totalInBuckets: number;
    monthAllocated: number;
    pending: number;
};

export function cofrinhoSummaryForPeriod(
    buckets: CofrinhoBucket[],
    applications: CofrinhoApplication[],
    expenses: Movement[],
    period: string,
    year: number
): CofrinhoSummary {
    const ym = yearMonthFromCivilPeriod(period, year);
    return {
        totalInBuckets: getTotalInBuckets(buckets, expenses, applications),
        monthAllocated: sumAllocatedInMonth(applications, buckets, ym),
        pending: computePendingBalance(expenses, ym)
    };
}