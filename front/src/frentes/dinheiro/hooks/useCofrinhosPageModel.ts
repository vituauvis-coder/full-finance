import { useMemo } from 'react';
import type { CofrinhoTripPayloadOutflow, FinanceData } from '../../../lib/types/finance';
import type { Movement } from '../../../lib/types/finance';
import {
    type CofrinhoApplication,
    type CofrinhoBucket,
    type CofrinhoBucketGoal
} from '../domain/cofrinhoAggregations';
import type { CofrinhoMonthlyBalance } from '../domain/cofrinhoMonthlyBalances';
import { ALL_YEARS_PERIOD, defaultCivilYear, defaultPeriod } from '../../../lib/period';
import { yearMonthFromCivilPeriod } from '../domain/cofrinhoPeriod';
import { type CofrinhoPeriodScope, resolveCofrinhoPeriodScope } from '../domain/cofrinhoPeriodScope';
import { listCofrinhoPoolPendingByMonth } from '../domain/cofrinhoPending';
import { cofrinhoHeroSummary, type CofrinhoSummary } from '../domain/cofrinhoSummaryStats';

export type CofrinhosPageModel = {
    currency: string;
    chartYear: number;
    goalYear: number;
    yearMonth: string;
    scope: CofrinhoPeriodScope;
    buckets: CofrinhoBucket[];
    applications: CofrinhoApplication[];
    goals: CofrinhoBucketGoal[];
    monthlyBalances: CofrinhoMonthlyBalance[];
    expenses: Movement[];
    tripPayloadOutflows: CofrinhoTripPayloadOutflow[];
    summary: CofrinhoSummary;
    pendingByMonth: ReturnType<typeof listCofrinhoPoolPendingByMonth>;
};

const EMPTY_SUMMARY: CofrinhoSummary = {
    totalContributed: 0,
    totalAccumulated: 0,
    averageMonthlyContribution: 0,
    totalYield: 0
};

export function useCofrinhosPageModel(data: FinanceData | null): CofrinhosPageModel | null {
    const currency = data?.userProfile?.currency ?? 'BRL';
    const chartYear = defaultCivilYear();
    const goalYear = chartYear;
    const yearMonth = yearMonthFromCivilPeriod(defaultPeriod(), chartYear);
    const scope = useMemo(
        () => resolveCofrinhoPeriodScope(ALL_YEARS_PERIOD, chartYear),
        [chartYear]
    );

    const buckets = useMemo(() => {
        if (!data) return [] as CofrinhoBucket[];
        return [...(data.cofrinhoBuckets as CofrinhoBucket[])].sort(
            (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
        );
    }, [data]);

    const applications = (data?.cofrinhoApplications ?? []) as CofrinhoApplication[];
    const goals = (data?.cofrinhoBucketGoals ?? []) as CofrinhoBucketGoal[];
    const monthlyBalances = (data?.cofrinhoMonthlyBalances ?? []) as CofrinhoMonthlyBalance[];
    const expenses = data?.userExpenses ?? [];
    const tripPayloadOutflows = data?.cofrinhoTripPayloadOutflows ?? [];
    const accounts = data?.userAccounts ?? [];

    const summary = useMemo(
        () =>
            data
                ? cofrinhoHeroSummary(
                      buckets,
                      applications,
                      expenses,
                      monthlyBalances,
                      accounts,
                      tripPayloadOutflows
                  )
                : EMPTY_SUMMARY,
        [accounts, applications, buckets, data, expenses, monthlyBalances, tripPayloadOutflows]
    );

    const pendingByMonth = useMemo(
        () => (data ? listCofrinhoPoolPendingByMonth(expenses) : []),
        [data, expenses]
    );

    if (!data) return null;

    return {
        currency,
        chartYear,
        goalYear,
        yearMonth,
        scope,
        buckets,
        applications,
        goals,
        monthlyBalances,
        expenses,
        tripPayloadOutflows,
        summary,
        pendingByMonth
    };
}