import { getExpensePerInstallmentDisplayAmount } from '@motor/dinheiro/credit-installments.js';
import { isCreditCardType } from '../../../lib/accounts';
import type { Account, Movement } from '../../../lib/types/finance';
import { computeMomVariation, type MomVariationState } from '../../dashboard/domain/momVariation';
import { filterMovementsInPeriod, type ListFilter } from '../../../lib/movementList';
import { isSingleMonthPeriod, listFilterForMomCompare, previousCivilMonth } from './movementPeriodMom';

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

export function aggregateExpenseTotals(rows: Movement[], accounts: Account[]): ExpenseSummaryTotals {
    const byId = new Map(accounts.map((a) => [a.id, a]));
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
        const amt = getExpensePerInstallmentDisplayAmount(t, acc) || Number(t.amount) || 0;
        total += amt;
        count += 1;
        if (expenseIsMarkedFixed(t)) {
            essential += amt;
            essentialCount += 1;
        } else if (acc && isCreditCardType(acc.type)) {
            creditCard += amt;
            creditCardCount += 1;
        } else {
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
    statusFilterActive: boolean
): ExpenseSummaryStats {
    if (!statusFilterActive) return { showHint: true };
    return { showHint: false, ...aggregateExpenseTotals(rows, accounts) };
}

export function expenseSummaryMomStates(
    allRows: Movement[],
    accounts: Account[],
    period: string,
    civilYear: number,
    current: ExpenseSummaryTotals,
    listFilter: ListFilter
): ExpenseSummaryMom {
    const isSingle = isSingleMonthPeriod(period);
    const prev = previousCivilMonth(period, civilYear);
    const need = { kind: 'need_single_month' as const };

    if (!isSingle || !prev) {
        return { total: need, essential: need, creditCard: need, other: need };
    }

    const prevRows = filterMovementsInPeriod(
        allRows,
        prev.period,
        prev.year,
        listFilterForMomCompare(listFilter)
    );
    const prevAgg = aggregateExpenseTotals(prevRows, accounts);

    return {
        total: computeMomVariation(current.total, prevAgg.total, true, true),
        essential: computeMomVariation(current.essential, prevAgg.essential, true, true),
        creditCard: computeMomVariation(current.creditCard, prevAgg.creditCard, true, true),
        other: computeMomVariation(current.other, prevAgg.other, true, true)
    };
}