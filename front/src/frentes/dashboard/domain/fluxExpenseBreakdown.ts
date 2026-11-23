import { getExpenseSummaryContributionAmount } from '@motor/dinheiro/expense-summary-amount.js';
import {
    expenseRowDisplayDate,
    filterExpensesInPeriod
} from '../../../lib/filterExpensesInPeriod';
import { monthIndexFromPeriod } from '../../../lib/period';
import type { Account, ExpenseSplitRequest, Movement } from '../../../lib/types/finance';
import {
    expenseIsMarkedCofrinho,
    expenseIsMarkedEssential,
    isExpenseFaturaLine
} from '../../dinheiro/domain/expenseLedgerBuckets';
import { expenseListPaymentStatus } from '../../dinheiro/domain/expensePeriodListTotal';
import { civilMonthKey } from '../../dinheiro/domain/expenseSummaryStats';
import { matchesDashboardExpenseCategories } from './expenseCategoryFilter';
import { computeDashboardWalletBuckets } from './dashboardWalletBuckets';

export type FluxExpenseBreakdownTotals = {
    saidaFixa: number;
    saidaFatura: number;
    saidaExtra: number;
    saidaCofrinho: number;
};

export const EMPTY_FLUX_BREAKDOWN: FluxExpenseBreakdownTotals = {
    saidaFixa: 0,
    saidaFatura: 0,
    saidaExtra: 0,
    saidaCofrinho: 0
};

type ExpenseBreakdownKind = 'fixa' | 'fatura' | 'extra' | 'cofrinho';

function rowBreakdownKind(m: Movement, accountById: Map<string, Account>): ExpenseBreakdownKind {
    if (expenseIsMarkedCofrinho(m)) return 'cofrinho';
    if (isExpenseFaturaLine(m, accountById)) return 'fatura';
    if (expenseIsMarkedEssential(m)) return 'fixa';
    return 'extra';
}

function bucketKeyTotals(
    buckets: ReturnType<typeof computeDashboardWalletBuckets>
): FluxExpenseBreakdownTotals {
    const byKey = new Map(buckets.map((b) => [b.key, b.amount]));
    return {
        saidaFixa: byKey.get('fixed') ?? 0,
        saidaFatura: byKey.get('invoices') ?? 0,
        saidaExtra: byKey.get('extra') ?? 0,
        saidaCofrinho: byKey.get('cofrinhos') ?? 0
    };
}

/** Saídas do mês — mesma regra da carteira (lista Saídas + rateios). */
export function fluxBreakdownForCivilPeriod(
    expenses: Movement[],
    accounts: Account[],
    period: string,
    civilYear: number,
    splitRequests: ExpenseSplitRequest[] = [],
    expenseCategories?: ReadonlySet<string>
): FluxExpenseBreakdownTotals {
    if (expenseCategories && expenseCategories.size > 0) {
        return breakdownFromContributionRows(
            filterExpensesInPeriod(expenses, accounts, period, civilYear, {
                paymentStatus: expenseListPaymentStatus()
            }).filter((e) => matchesDashboardExpenseCategories(e.category, expenseCategories)),
            expenses,
            accounts,
            period,
            civilYear,
            splitRequests
        );
    }
    return bucketKeyTotals(
        computeDashboardWalletBuckets(expenses, accounts, period, civilYear, splitRequests)
    );
}

function breakdownFromContributionRows(
    rows: Movement[],
    allExpenses: Movement[],
    accounts: Account[],
    period: string,
    civilYear: number,
    splitRequests: ExpenseSplitRequest[]
): FluxExpenseBreakdownTotals {
    const accountById = new Map(accounts.map((a) => [a.id, a]));
    const monthKey = civilMonthKey(period, civilYear) ?? '';
    const totals: FluxExpenseBreakdownTotals = { ...EMPTY_FLUX_BREAKDOWN };

    for (const m of rows) {
        const acc = m.accountId ? accountById.get(String(m.accountId)) : undefined;
        const amt = getExpenseSummaryContributionAmount(m, acc, splitRequests, allExpenses, monthKey);
        if (!Number.isFinite(amt) || amt <= 0) continue;
        const kind = rowBreakdownKind(m, accountById);
        if (kind === 'fixa') totals.saidaFixa += amt;
        else if (kind === 'fatura') totals.saidaFatura += amt;
        else if (kind === 'cofrinho') totals.saidaCofrinho += amt;
        else totals.saidaExtra += amt;
    }

    return totals;
}

/** Distribui saídas do mês por dia (data de exibição da lista). */
export function fluxDailyBreakdownInMonth(
    expenses: Movement[],
    accounts: Account[],
    period: string,
    civilYear: number,
    splitRequests: ExpenseSplitRequest[] = [],
    expenseCategories?: ReadonlySet<string>
): FluxExpenseBreakdownTotals[] {
    const mi = monthIndexFromPeriod(period);
    const daysInMonth = new Date(civilYear, mi + 1, 0).getDate();
    const buckets: FluxExpenseBreakdownTotals[] = Array.from({ length: daysInMonth }, () => ({
        ...EMPTY_FLUX_BREAKDOWN
    }));

    const rows = filterExpensesInPeriod(expenses, accounts, period, civilYear, {
        paymentStatus: expenseListPaymentStatus()
    }).filter((e) => matchesDashboardExpenseCategories(e.category, expenseCategories));

    const accountById = new Map(accounts.map((a) => [a.id, a]));
    const monthKey = civilMonthKey(period, civilYear) ?? '';

    for (const m of rows) {
        const acc = m.accountId ? accountById.get(String(m.accountId)) : undefined;
        const due = expenseRowDisplayDate(m, acc, period, civilYear);
        if (due.getFullYear() !== civilYear || due.getMonth() !== mi) continue;
        const dayIndex = due.getDate() - 1;
        if (dayIndex < 0 || dayIndex >= daysInMonth) continue;
        const amt = getExpenseSummaryContributionAmount(m, acc, splitRequests, expenses, monthKey);
        if (!Number.isFinite(amt) || amt <= 0) continue;
        const kind = rowBreakdownKind(m, accountById);
        if (kind === 'fixa') buckets[dayIndex].saidaFixa += amt;
        else if (kind === 'fatura') buckets[dayIndex].saidaFatura += amt;
        else if (kind === 'cofrinho') buckets[dayIndex].saidaCofrinho += amt;
        else buckets[dayIndex].saidaExtra += amt;
    }

    return buckets;
}

export function balancoFromFluxBreakdown(entrada: number, breakdown: FluxExpenseBreakdownTotals): number {
    return entrada - breakdown.saidaFixa - breakdown.saidaFatura;
}