import { fetchYearChartBalanceSeries } from '@motor/dinheiro/chart-month-balance.js';
import type { Account, Movement, UserProfile } from '../../../lib/types/finance';
import { fetchPeriodBalance } from '../api/dashboardBalance';

export type YearBalanceSeriesInput = {
    civilYear: number;
    gains: Movement[];
    expenses: Movement[];
    accounts: Account[];
    userProfile?: UserProfile | null;
    splitRequests?: unknown[] | null;
    now?: Date;
};

export function fetchYearBalanceSeries(input: YearBalanceSeriesInput): Promise<(number | null)[]> {
    const now = input.now ?? new Date();
    const splits = input.splitRequests ?? null;
    const fetchBalance = (start: Date, end: Date) => fetchPeriodBalance(start, end);

    return fetchYearChartBalanceSeries(
        input.civilYear,
        now,
        fetchBalance,
        input.gains,
        input.expenses,
        input.accounts,
        input.userProfile ?? null,
        splits
    );
}