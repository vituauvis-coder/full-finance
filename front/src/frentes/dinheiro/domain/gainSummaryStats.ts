import { gainCountsInTotals, gainTopLevelCategory } from '../../../lib/gainTreemap';
import type { Movement } from '../../../lib/types/finance';
import { computeMomVariation, type MomVariationState } from '../../dashboard/domain/momVariation';
import { filterMovementsInPeriod, type ListFilter } from '../../../lib/movementList';
import { isSingleMonthPeriod, listFilterForMomCompare, previousCivilMonth } from './movementPeriodMom';

export type GainSummaryTotals = {
    received: number;
    pending: number;
    total: number;
    receivedCount: number;
    pendingCount: number;
    fixed: number;
    extra: number;
};

export function isGainFixedCategory(category: string): boolean {
    const raw = String(category || '').trim().toLowerCase();
    const c = raw.normalize('NFD').replace(/\p{M}/gu, '');
    if (c === 'vr') return true;
    if (c === 'salario') return true;
    if (raw === 'salário') return true;
    if (c === 'vale refeicao') return true;
    return false;
}

export type GainSummaryStats = { showHint: true } | ({ showHint: false } & GainSummaryTotals);

export type GainSummaryMom = {
    total: MomVariationState;
    fixed: MomVariationState;
    extra: MomVariationState;
};

export function aggregateGainTotals(rows: Movement[]): GainSummaryTotals {
    let received = 0;
    let pending = 0;
    let receivedCount = 0;
    let pendingCount = 0;
    let fixed = 0;
    let extra = 0;

    for (const t of rows) {
        if (!gainCountsInTotals(t)) continue;
        const amt = Number(t.amount) || 0;
        if (t.isPaid === false) {
            pending += amt;
            pendingCount += 1;
        } else {
            received += amt;
            receivedCount += 1;
        }
        const cat = gainTopLevelCategory(t);
        if (isGainFixedCategory(cat)) fixed += amt;
        else extra += amt;
    }

    return {
        received,
        pending,
        total: received + pending,
        receivedCount,
        pendingCount,
        fixed,
        extra
    };
}

export function gainSummaryFromRows(rows: Movement[], statusFilterActive: boolean): GainSummaryStats {
    if (!statusFilterActive) return { showHint: true };
    return { showHint: false, ...aggregateGainTotals(rows) };
}

export function gainSummaryMomStates(
    allRows: Movement[],
    period: string,
    civilYear: number,
    current: GainSummaryTotals,
    listFilter: ListFilter
): GainSummaryMom {
    const isSingle = isSingleMonthPeriod(period);
    const prev = previousCivilMonth(period, civilYear);
    const hidden = { kind: 'hidden' as const };

    if (!isSingle || !prev) {
        const need = { kind: 'need_single_month' as const };
        return { total: need, fixed: need, extra: need };
    }

    const prevRows = filterMovementsInPeriod(
        allRows,
        prev.period,
        prev.year,
        listFilterForMomCompare(listFilter)
    );
    const prevAgg = aggregateGainTotals(prevRows);

    return {
        total: computeMomVariation(current.total, prevAgg.total, true, false),
        fixed: computeMomVariation(current.fixed, prevAgg.fixed, true, false),
        extra: computeMomVariation(current.extra, prevAgg.extra, true, false)
    };
}

export function gainSummaryMomWhenHint(): GainSummaryMom {
    const hidden = { kind: 'hidden' as const };
    return { total: hidden, fixed: hidden, extra: hidden };
}