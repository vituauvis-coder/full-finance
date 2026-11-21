import { useMemo } from 'react';
import type { ZeroBudgetBlock } from '../domain/zeroBudgetTypes';
import { buildZeroBudgetBarSegments } from '../domain/buildZeroBudgetBarSegments';
import { ZeroBudgetSummaryHero } from './zero-budget/ZeroBudgetSummaryHero';

type Props = {
    currency: string;
    availableBalance: number;
    totalAllocated: number;
    blocks: ZeroBudgetBlock[];
};

export function ZeroBudgetSummaryPanel({ currency, availableBalance, totalAllocated, blocks }: Props) {
    const remaining = availableBalance - totalAllocated;
    const isOverallocated = remaining < 0;
    const { segs, denom } = useMemo(
        () => buildZeroBudgetBarSegments(blocks, availableBalance, totalAllocated, remaining),
        [availableBalance, blocks, remaining, totalAllocated]
    );

    return (
        <ZeroBudgetSummaryHero
            currency={currency}
            availableBalance={availableBalance}
            totalAllocated={totalAllocated}
            remaining={remaining}
            isOverallocated={isOverallocated}
            barSegments={segs}
            barDenom={denom}
        />
    );
}