import {
    calcAvailableBalance,
    calcMaxAllocation,
    calcTotalAllocated
} from '@legacy/js/core/zero-budget-calculator.js';
import type { FinanceData } from '../../../lib/types/finance';
import type { ZeroBudgetBlock } from './zeroBudgetTypes';
import { gainsWithSyntheticExpectedSplits } from '../../dashboard/domain/syntheticSplitGains';

export { calcMaxAllocation, calcTotalAllocated };

export function mergedGainsForZeroBudget(data: FinanceData, month: number, year: number) {
    const period = `month-${month - 1}`;
    const planningNow = new Date(year, month - 1, 15);
    return gainsWithSyntheticExpectedSplits({
        period,
        civilYear: year,
        gains: data.userGains ?? [],
        expenses: data.userExpenses ?? [],
        accounts: data.userAccounts ?? [],
        splitBundle: data.expenseSplitRequests,
        now: planningNow
    });
}

export function zeroBudgetAvailableBalance(data: FinanceData, month: number, year: number): number {
    const gains = mergedGainsForZeroBudget(data, month, year);
    return calcAvailableBalance(gains, data.userExpenses ?? [], month, year, {
        accounts: data.userAccounts ?? [],
        userProfile: data.userProfile ?? null,
        splitOutgoing: data.expenseSplitRequests?.outgoing ?? []
    });
}

export function collectExpenseCategoryNames(
    categories: { name?: string; type?: string }[],
    expenses: { category?: string }[]
): string[] {
    const names = new Set<string>();
    for (const c of categories) {
        const t = String(c?.type ?? '').toUpperCase();
        if (t === 'EXPENSE' || !c?.type) {
            const n = String(c?.name ?? '').trim();
            if (n) names.add(n);
        }
    }
    for (const e of expenses) {
        const n = String(e?.category ?? '').trim();
        if (n) names.add(n);
    }
    return [...names].sort((a, b) => a.localeCompare(b, 'pt'));
}

export function blockCategoryName(block: { categoryName?: string; name?: string; categories?: string[] }): string {
    const n = block?.categoryName ?? block?.categories?.[0] ?? block?.name;
    return String(n || '').trim();
}

const REMAINING_TONE_CLASSES = [
    'zero-budget__stat--remaining-safe',
    'zero-budget__stat--remaining-warn',
    'zero-budget__stat--remaining-neutral'
] as const;

const REMAINING_SAFE_RATIO = 0.22;

/** Classes do card «Restante» — paridade com legado. */
export function remainingToneClass(
    availableBalance: number,
    remaining: number,
    isOverallocated: boolean
): (typeof REMAINING_TONE_CLASSES)[number] | null {
    if (isOverallocated || remaining < 0) return null;
    if (remaining <= 0) return 'zero-budget__stat--remaining-neutral';
    const avail = Number(availableBalance) || 0;
    if (avail <= 0) {
        return 'zero-budget__stat--remaining-safe';
    }
    const ratio = remaining / avail;
    return ratio > REMAINING_SAFE_RATIO ? 'zero-budget__stat--remaining-safe' : 'zero-budget__stat--remaining-warn';
}

export function remainingToneClassList(
    availableBalance: number,
    remaining: number,
    isOverallocated: boolean
): string {
    const tone = remainingToneClass(availableBalance, remaining, isOverallocated);
    const base = 'zero-budget__stat zero-budget__stat--remaining';
    return tone ? `${base} ${tone}` : base;
}

export type RemainingSummaryMetricTone = 'burst' | 'safe' | 'warn' | 'neutral';

export function remainingSummaryMetricTone(
    availableBalance: number,
    remaining: number,
    isOverallocated: boolean
): RemainingSummaryMetricTone {
    if (isOverallocated) return 'burst';
    const tone = remainingToneClass(availableBalance, remaining, isOverallocated);
    if (tone === 'zero-budget__stat--remaining-safe') return 'safe';
    if (tone === 'zero-budget__stat--remaining-warn') return 'warn';
    return 'neutral';
}

/** Texto auxiliar da coluna «Alocado» no resumo (par com remainingAllocationHint). */
export function allocatedAllocationHint(
    availableBalance: number,
    totalAllocated: number,
    isOverallocated: boolean
): string {
    if (isOverallocated) return 'Acima do saldo livre';
    if (availableBalance <= 0) {
        return totalAllocated > 0 ? 'Fora do saldo do mês' : 'Sem saldo no mês';
    }
    const pct = Math.min(100, Math.round((totalAllocated / availableBalance) * 100));
    if (pct <= 0) return 'Nada nas metas ainda';
    if (pct >= 100) return 'Saldo todo em blocos';
    return `${pct}% do saldo livre`;
}

export function allocatedSummaryMetricTone(
    availableBalance: number,
    totalAllocated: number,
    isOverallocated: boolean
): RemainingSummaryMetricTone {
    if (isOverallocated) return 'burst';
    if (availableBalance > 0) {
        const pct = Math.min(100, Math.round((totalAllocated / availableBalance) * 100));
        if (pct >= 100) return 'safe';
        if (pct >= 22) return 'neutral';
    }
    return 'neutral';
}

/** Texto auxiliar do card «Restante» / «Estourado» no resumo. */
export function remainingAllocationHint(
    availableBalance: number,
    remaining: number,
    isOverallocated: boolean
): string {
    if (isOverallocated) return 'Acima do saldo livre do mês';
    if (remaining <= 0) return 'Tudo distribuído';
    const tone = remainingToneClass(availableBalance, remaining, isOverallocated);
    if (tone === 'zero-budget__stat--remaining-safe') return 'Margem para alocar';
    if (tone === 'zero-budget__stat--remaining-warn') return 'Falta destinar';
    return 'Sem destino';
}

/** Aplica prévias locais de alocação (ex.: arrasto do slider) sem alterar o array original. */
export function blocksWithAllocationPreviews(
    blocks: ZeroBudgetBlock[],
    previews: Readonly<Record<string, number>>
): ZeroBudgetBlock[] {
    if (Object.keys(previews).length === 0) return blocks;
    return blocks.map((b) => {
        const next = previews[b.id];
        return next === undefined ? b : { ...b, allocatedAmount: next };
    });
}

export function sliderFillPercent(value: number, max: number): number {
    const m = Number(max);
    if (!Number.isFinite(m) || m <= 0) return 0;
    const v = Math.min(Math.max(0, Number(value) || 0), m);
    return Math.min(100, Math.max(0, (v / m) * 100));
}