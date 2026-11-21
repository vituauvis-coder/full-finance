import { useMemo } from 'react';
import type { FinanceData } from '../../../lib/types/finance';
import type { Movement } from '../../../lib/types/finance';
import {
    type CofrinhoApplication,
    type CofrinhoBucket,
    type CofrinhoBucketGoal
} from '../domain/cofrinhoAggregations';
import { yearMonthFromCivilPeriod } from '../domain/cofrinhoPeriod';
import { cofrinhoSummaryForPeriod, type CofrinhoSummary } from '../domain/cofrinhoSummaryStats';

export type CofrinhosPageModel = {
    currency: string;
    yearMonth: string;
    buckets: CofrinhoBucket[];
    applications: CofrinhoApplication[];
    goals: CofrinhoBucketGoal[];
    expenses: Movement[];
    summary: CofrinhoSummary;
};

const EMPTY_SUMMARY: CofrinhoSummary = {
    totalInBuckets: 0,
    monthAllocated: 0,
    pending: 0
};

export function useCofrinhosPageModel(
    data: FinanceData | null,
    period: string,
    year: number
): CofrinhosPageModel | null {
    const currency = data?.userProfile?.currency ?? 'BRL';
    const yearMonth = yearMonthFromCivilPeriod(period, year);

    const buckets = useMemo(() => {
        if (!data) return [] as CofrinhoBucket[];
        return [...(data.cofrinhoBuckets as CofrinhoBucket[])].sort(
            (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
        );
    }, [data]);

    const applications = (data?.cofrinhoApplications ?? []) as CofrinhoApplication[];
    const goals = (data?.cofrinhoBucketGoals ?? []) as CofrinhoBucketGoal[];
    const expenses = data?.userExpenses ?? [];

    const summary = useMemo(
        () =>
            data
                ? cofrinhoSummaryForPeriod(buckets, applications, expenses, period, year)
                : EMPTY_SUMMARY,
        [applications, buckets, data, expenses, period, year]
    );

    if (!data) return null;

    return { currency, yearMonth, buckets, applications, goals, expenses, summary };
}