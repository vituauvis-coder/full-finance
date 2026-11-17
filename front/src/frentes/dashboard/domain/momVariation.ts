export type MomVariationState =
    | { kind: 'pct'; diffPct: number; invertExpenseSemantics: boolean }
    | { kind: 'need_single_month' }
    | { kind: 'no_previous_base' }
    | { kind: 'no_values' }
    | { kind: 'hidden' };

export function computeMomVariation(
    totalPeriod: number,
    totalPrevMonth: number,
    isSingleMonth: boolean,
    invertExpenseSemantics: boolean
): MomVariationState {
    if (!isSingleMonth) return { kind: 'need_single_month' };
    if (totalPrevMonth > 0) {
        const diff = ((totalPeriod - totalPrevMonth) / totalPrevMonth) * 100;
        return { kind: 'pct', diffPct: diff, invertExpenseSemantics };
    }
    if (totalPeriod > 0) return { kind: 'no_previous_base' };
    return { kind: 'no_values' };
}

export function momPctClass(diffPct: number, invertExpenseSemantics: boolean): 'positive' | 'negative' {
    const isIncrease = diffPct > 0;
    const isPositive = invertExpenseSemantics ? !isIncrease : isIncrease;
    return isPositive ? 'positive' : 'negative';
}