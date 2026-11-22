import { expenseContributionPaidThroughListMonthKey } from '@motor/dinheiro/expense-list-month-contribution.js';
import { getMonthKeysInPeriod } from '@motor/dinheiro/period-bounds.js';
import { monthKeyFromDate } from '@motor/dinheiro/finance-preferences.js';
import { isCreditCardType } from '../../../lib/accounts';
import { filterExpensesByListFilter } from '../../../lib/filterExpensesInPeriod';
import { CIVIL_YEAR_PERIOD } from '../../../lib/period';
import { aggregateByCategory } from '../../../lib/treemapData';
import type { Account, Movement, UserProfile } from '../../../lib/types/finance';
import type { ListFilter } from '../../../lib/movementList';
import {
    expenseIsMarkedFixed,
    type ExpenseSummarySplitOpts,
    type ExpenseSummaryTotals
} from './expenseSummaryStats';

function civilYearMonthKeys(civilYear: number, now = new Date()) {
    const keys = getMonthKeysInPeriod(CIVIL_YEAR_PERIOD, now, { civilYear });
    const currentMk = monthKeyFromDate(now);
    return keys.filter((mk) => {
        if (civilYear > now.getFullYear()) return false;
        if (civilYear === now.getFullYear() && mk > currentMk) return false;
        return true;
    });
}

function sumContributionsForYear(
    rows: Movement[],
    accounts: Account[],
    civilYear: number,
    splitOpts: ExpenseSummarySplitOpts,
    userProfile?: UserProfile | null
) {
    const byId = new Map(accounts.map((a) => [a.id, a]));
    const splits = splitOpts.splitRequests ?? [];
    const allEx = splitOpts.allUserExpenses ?? rows;
    const months = civilYearMonthKeys(civilYear);
    let total = 0;
    let essential = 0;
    let creditCard = 0;
    let other = 0;
    let count = 0;
    const counted = new Set<string>();

    for (const mk of months) {
        const cutoff = new Date(Number(mk.slice(0, 4)), Number(mk.slice(5, 7)), 0, 23, 59, 59, 999);
        for (const t of rows) {
            const acc = t.accountId ? byId.get(t.accountId) : undefined;
            const contrib = expenseContributionPaidThroughListMonthKey(
                t,
                acc,
                mk,
                cutoff,
                userProfile,
                splits,
                allEx
            );
            if (contrib <= 0) continue;
            total += contrib;
            if (!counted.has(t.id)) {
                counted.add(t.id);
                count += 1;
            }
            if (expenseIsMarkedFixed(t)) essential += contrib;
            if (acc && isCreditCardType(acc.type)) creditCard += contrib;
            if (!expenseIsMarkedFixed(t) && !(acc && isCreditCardType(acc.type))) other += contrib;
        }
    }

    return {
        total,
        essential,
        creditCard,
        other,
        count,
        essentialCount: 0,
        creditCardCount: 0,
        otherCount: 0
    } satisfies ExpenseSummaryTotals;
}

export function aggregateExpenseTotalsCivilYear(
    allRows: Movement[],
    accounts: Account[],
    civilYear: number,
    listFilter: ListFilter,
    splitOpts: ExpenseSummarySplitOpts,
    userProfile?: UserProfile | null
): ExpenseSummaryTotals {
    const rows = filterExpensesByListFilter(allRows, accounts, listFilter);
    return sumContributionsForYear(rows, accounts, civilYear, splitOpts, userProfile);
}

/** Treemap por categoria — soma mês a mês (cartão por vencimento). */
export function buildExpenseTreemapBlocksCivilYear(
    allRows: Movement[],
    accounts: Account[],
    civilYear: number,
    listFilter: ListFilter,
    splitOpts: ExpenseSummarySplitOpts,
    userProfile?: UserProfile | null
) {
    const rows = filterExpensesByListFilter(allRows, accounts, listFilter);
    const byId = new Map(accounts.map((a) => [a.id, a]));
    const splits = splitOpts.splitRequests ?? [];
    const allEx = splitOpts.allUserExpenses ?? rows;
    const months = civilYearMonthKeys(civilYear);
    const synthetic: Movement[] = [];

    for (const mk of months) {
        const cutoff = new Date(Number(mk.slice(0, 4)), Number(mk.slice(5, 7)), 0, 23, 59, 59, 999);
        for (const t of rows) {
            const acc = t.accountId ? byId.get(t.accountId) : undefined;
            const contrib = expenseContributionPaidThroughListMonthKey(
                t,
                acc,
                mk,
                cutoff,
                userProfile,
                splits,
                allEx
            );
            if (contrib <= 0) continue;
            synthetic.push({
                ...t,
                amount: contrib,
                category: t.category || 'Sem categoria',
                subcategory: (t.subcategory && String(t.subcategory).trim()) || 'Geral'
            });
        }
    }

    return aggregateByCategory(synthetic);
}
