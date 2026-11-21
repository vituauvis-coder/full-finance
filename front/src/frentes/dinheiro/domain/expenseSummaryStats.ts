import { getExpenseSummaryContributionAmount } from '@motor/dinheiro/expense-summary-amount.js';
import { isCreditCardType } from '../../../lib/accounts';
import type { Account, ExpenseSplitRequest, Movement } from '../../../lib/types/finance';
import { computeMomVariation, type MomVariationState } from '../../dashboard/domain/momVariation';
import { filterExpensesInPeriod } from '../../../lib/filterExpensesInPeriod';
import type { ListFilter } from '../../../lib/movementList';
import { isSingleMonthPeriod, listFilterForMomCompare, previousCivilMonth } from './movementPeriodMom';

export type ExpenseSummarySplitOpts = {
    splitRequests?: ExpenseSplitRequest[];
    allUserExpenses?: Movement[] | null;
    /** `YYYY-MM` do mês civil em exibição (rateios por parcela). */
    monthKey?: string;
};

/** Chave `YYYY-MM` a partir de `month-N` + ano civil. */
export function civilMonthKey(period: string, civilYear: number): string | null {
    if (!isSingleMonthPeriod(period)) return null;
    const m = /^month-(\d+)$/.exec(period || '');
    if (!m) return null;
    const mi = Math.min(11, Math.max(0, parseInt(m[1], 10)));
    return `${civilYear}-${String(mi + 1).padStart(2, '0')}`;
}

export type ExpenseSummaryTotals = {
    total: number;
    essential: number;
    creditCard: number;
    other: number;
    count: number;
    essentialCount: number;
    creditCardCount: number;
    otherCount: number;
};

export type ExpenseSummaryStats = { showHint: true } | ({ showHint: false } & ExpenseSummaryTotals);

export type ExpenseSummaryMom = {
    total: MomVariationState;
    essential: MomVariationState;
    creditCard: MomVariationState;
    other: MomVariationState;
};

function expenseIsMarkedFixed(t: Movement) {
    return (
        t.isFixed === true ||
        t.isFixed === 'true' ||
        t.isFixed === 1 ||
        t.isFixed === '1'
    );
}

export function aggregateExpenseTotals(
    rows: Movement[],
    accounts: Account[],
    splitOpts: ExpenseSummarySplitOpts = {}
): ExpenseSummaryTotals {
    const byId = new Map(accounts.map((a) => [a.id, a]));
    const splits = splitOpts.splitRequests ?? [];
    const allEx = splitOpts.allUserExpenses ?? null;
    const monthKey = splitOpts.monthKey ?? '';
    let total = 0;
    let essential = 0;
    let creditCard = 0;
    let other = 0;
    let count = 0;
    let essentialCount = 0;
    let creditCardCount = 0;
    let otherCount = 0;

    for (const t of rows) {
        const acc = t.accountId ? byId.get(t.accountId) : undefined;
        const amt = getExpenseSummaryContributionAmount(t, acc, splits, allEx, monthKey);
        total += amt;
        count += 1;
        // Alinhado ao legacy: essencial e cartão são eixos independentes (cartão essencial
        // entra nos dois cards). «Outras» = nem essencial nem cartão.
        if (expenseIsMarkedFixed(t)) {
            essential += amt;
            essentialCount += 1;
        }
        if (acc && isCreditCardType(acc.type)) {
            creditCard += amt;
            creditCardCount += 1;
        }
        if (!expenseIsMarkedFixed(t) && !(acc && isCreditCardType(acc.type))) {
            other += amt;
            otherCount += 1;
        }
    }

    return {
        total,
        essential,
        creditCard,
        other,
        count,
        essentialCount,
        creditCardCount,
        otherCount
    };
}

/** Totais na lista filtrada — estrutura dos 4 cards legados (valores simplificados vs. motor mensal). */
export function expenseSummaryFromRows(
    rows: Movement[],
    accounts: Account[],
    statusFilterActive: boolean,
    splitOpts: ExpenseSummarySplitOpts = {}
): ExpenseSummaryStats {
    if (!statusFilterActive) return { showHint: true };
    return { showHint: false, ...aggregateExpenseTotals(rows, accounts, splitOpts) };
}

export function expenseSummaryMomStates(
    allRows: Movement[],
    accounts: Account[],
    period: string,
    civilYear: number,
    current: ExpenseSummaryTotals,
    listFilter: ListFilter,
    splitOpts: ExpenseSummarySplitOpts = {}
): ExpenseSummaryMom {
    const isSingle = isSingleMonthPeriod(period);
    const prev = previousCivilMonth(period, civilYear);
    const need = { kind: 'need_single_month' as const };

    if (!isSingle || !prev) {
        return { total: need, essential: need, creditCard: need, other: need };
    }

    const prevRows = filterExpensesInPeriod(
        allRows,
        accounts,
        prev.period,
        prev.year,
        listFilterForMomCompare(listFilter)
    );
    const prevAgg = aggregateExpenseTotals(prevRows, accounts, {
        ...splitOpts,
        monthKey: civilMonthKey(prev.period, prev.year) ?? ''
    });

    return {
        total: computeMomVariation(current.total, prevAgg.total, true, true),
        essential: computeMomVariation(current.essential, prevAgg.essential, true, true),
        creditCard: computeMomVariation(current.creditCard, prevAgg.creditCard, true, true),
        other: computeMomVariation(current.other, prevAgg.other, true, true)
    };
}