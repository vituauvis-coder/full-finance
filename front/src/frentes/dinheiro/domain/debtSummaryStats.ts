import { computeMomVariation, type MomVariationState } from '../../dashboard/domain/momVariation';
import { computeDebtsSummary, type DebtsSummary } from './debtAggregations';
import type { Debt, DebtUpdate } from './debtTypes';

export function debtsSummaryFromData(debts: Debt[], updates: DebtUpdate[]): DebtsSummary {
    return computeDebtsSummary(debts, updates);
}

export function debtsSummaryMonthMom(summary: DebtsSummary): MomVariationState {
    return computeMomVariation(summary.totalCurrentMonth, summary.totalPrevMonth, true, true);
}