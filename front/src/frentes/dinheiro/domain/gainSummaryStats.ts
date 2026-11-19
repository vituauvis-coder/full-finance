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
    topCategory: string;
    topCategoryAmount: number;
};

export type GainSummaryStats = { showHint: true } | ({ showHint: false } & GainSummaryTotals);

export type GainSummaryMom = {
    received: MomVariationState;
    pending: MomVariationState;
    topCategory: MomVariationState;
};

export function aggregateGainTotals(rows: Movement[]): GainSummaryTotals {
    let received = 0;
    let pending = 0;
    let receivedCount = 0;
    let pendingCount = 0;
    const byCat = new Map<string, number>();

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
        byCat.set(cat, (byCat.get(cat) ?? 0) + amt);
    }

    let topCategory = '—';
    let topAmt = 0;
    byCat.forEach((amt, cat) => {
        if (amt > topAmt) {
            topAmt = amt;
            topCategory = cat;
        }
    });

    return {
        received,
        pending,
        total: received + pending,
        receivedCount,
        pendingCount,
        topCategory: topAmt > 0 ? topCategory : '—',
        topCategoryAmount: topAmt
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
        return { received: need, pending: need, topCategory: need };
    }

    const prevRows = filterMovementsInPeriod(
        allRows,
        prev.period,
        prev.year,
        listFilterForMomCompare(listFilter)
    );
    const prevAgg = aggregateGainTotals(prevRows);

    return {
        received: computeMomVariation(current.received, prevAgg.received, true, false),
        pending: computeMomVariation(current.pending, prevAgg.pending, true, false),
        topCategory: computeMomVariation(current.topCategoryAmount, prevAgg.topCategoryAmount, true, false)
    };
}

export function gainSummaryMomWhenHint(): GainSummaryMom {
    const hidden = { kind: 'hidden' as const };
    return { received: hidden, pending: hidden, topCategory: hidden };
}