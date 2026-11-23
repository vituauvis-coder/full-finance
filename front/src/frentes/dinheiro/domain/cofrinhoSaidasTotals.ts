import { getExpenseSummaryContributionAmount } from '@motor/dinheiro/expense-summary-amount.js';
import type { Account, Movement } from '../../../lib/types/finance';
import type { CategoryBlock } from '../../../lib/treemapData';
import { expenseIsMarkedCofrinho } from './expenseLedgerBuckets';
import {
    isCofrinhoPoolExpense,
    type CofrinhoApplication,
    type CofrinhoBucket
} from './cofrinhoAggregations';
import { COFRINHO_POOL_SUBCATEGORY, EXPENSE_COFRINHO_CATEGORY } from './cofrinhoConstants';
import { buildCofrinhoLedgerRows, type CofrinhoTripPayloadOutflow } from './cofrinhoLedgerRows';
import { mergeCofrinhoLedgerWithYield } from './cofrinhoYieldLedger';
import type { CofrinhoMonthlyBalance } from './cofrinhoMonthlyBalances';
import { resolveCofrinhoPeriodScope } from './cofrinhoPeriodScope';
import type { ExpenseSummarySplitOpts, ExpenseSummaryTotals } from './expenseSummaryStats';

export type CofrinhoSaidasMetricsInput = {
    allExpenses: Movement[];
    filtered: Movement[];
    accounts: Account[];
    buckets: CofrinhoBucket[];
    applications: CofrinhoApplication[];
    monthlyBalances: CofrinhoMonthlyBalance[];
    tripPayloadOutflows: CofrinhoTripPayloadOutflow[];
    period: string;
    civilYear: number;
    splitOpts?: ExpenseSummarySplitOpts;
    accountFilterId?: string;
};

function sumPoolCashInFiltered(
    filtered: Movement[],
    accounts: Account[],
    splitOpts: ExpenseSummarySplitOpts = {}
): number {
    const byId = new Map(accounts.map((a) => [a.id, a]));
    const splits = splitOpts.splitRequests ?? [];
    const allEx = splitOpts.allUserExpenses ?? null;
    const monthKey = splitOpts.monthKey ?? '';
    let poolTotal = 0;
    for (const e of filtered) {
        if (!isCofrinhoPoolExpense(e) || e.isPaid === false) continue;
        const acc = e.accountId ? byId.get(e.accountId) : undefined;
        const amt =
            getExpenseSummaryContributionAmount(e, acc, splits, allEx, monthKey) || Number(e.amount) || 0;
        if (amt > 0.001) poolTotal += amt;
    }
    return poolTotal;
}

/** Mesma base do extrato de Cofrinhos: entradas na caixinha, sem rendimento. */
export function sumCofrinhoLedgerInflowsByBucket(
    input: CofrinhoSaidasMetricsInput
): Map<string, number> {
    const scope = resolveCofrinhoPeriodScope(input.period, input.civilYear);
    const base = buildCofrinhoLedgerRows(
        input.allExpenses,
        input.applications,
        input.buckets,
        input.accounts,
        scope,
        input.tripPayloadOutflows
    );
    const merged = mergeCofrinhoLedgerWithYield(
        base,
        input.monthlyBalances,
        input.buckets,
        scope
    );
    const subTotals = new Map<string, number>();
    const accountFilter = input.accountFilterId?.trim() || '';

    for (const r of merged) {
        if (r.kind !== 'in' || r.isYield) continue;
        if (accountFilter && r.accountId && r.accountId !== accountFilter) continue;
        const name = r.bucketName?.trim() || 'Caixinha';
        subTotals.set(name, (subTotals.get(name) ?? 0) + r.amount);
    }

    return subTotals;
}

function toFlatTreemapBlocks(subTotals: Map<string, number>): CategoryBlock[] {
    const subcategories = [...subTotals.entries()]
        .map(([name, total]) => ({ name, total }))
        .filter((s) => s.total > 0.001)
        .sort((a, b) => b.total - a.total);
    if (!subcategories.length) return [];
    return subcategories.map(({ name, total }) => ({
        name,
        total,
        subcategories: [{ name: EXPENSE_COFRINHO_CATEGORY, total }]
    }));
}

export function buildCofrinhoCategoryBlockFromLedger(input: CofrinhoSaidasMetricsInput): CategoryBlock | null {
    const subTotals = sumCofrinhoLedgerInflowsByBucket(input);
    const poolTotal = sumPoolCashInFiltered(input.filtered, input.accounts, input.splitOpts);
    if (poolTotal > 0.001) {
        subTotals.set(
            COFRINHO_POOL_SUBCATEGORY,
            (subTotals.get(COFRINHO_POOL_SUBCATEGORY) ?? 0) + poolTotal
        );
    }
    const subcategories = [...subTotals.entries()]
        .map(([name, total]) => ({ name, total }))
        .filter((s) => s.total > 0.001)
        .sort((a, b) => b.total - a.total);
    const total = subcategories.reduce((s, c) => s + c.total, 0);
    if (total <= 0.001) return null;
    return { name: EXPENSE_COFRINHO_CATEGORY, total, subcategories };
}

/** Mapa quando o drawer está filtrado em Cofrinhos (um tile por caixinha + pool). */
export function buildCofrinhoCashOutTreemapBlocks(input: CofrinhoSaidasMetricsInput): CategoryBlock[] {
    const subTotals = sumCofrinhoLedgerInflowsByBucket(input);
    const poolTotal = sumPoolCashInFiltered(input.filtered, input.accounts, input.splitOpts);
    if (poolTotal > 0.001) {
        subTotals.set(
            COFRINHO_POOL_SUBCATEGORY,
            (subTotals.get(COFRINHO_POOL_SUBCATEGORY) ?? 0) + poolTotal
        );
    }
    return toFlatTreemapBlocks(subTotals);
}

export function patchExpenseTreemapCofrinhoCategory(
    blocks: CategoryBlock[],
    input: CofrinhoSaidasMetricsInput
): CategoryBlock[] {
    const patched = buildCofrinhoCategoryBlockFromLedger(input);
    const rest = blocks.filter((b) => b.name !== EXPENSE_COFRINHO_CATEGORY);
    if (!patched) return rest;
    return [...rest, patched].sort((a, b) => b.total - a.total);
}

export function aggregateCofrinhoCategoryTotalsFromFiltered(input: CofrinhoSaidasMetricsInput): ExpenseSummaryTotals {
    const blocks = buildCofrinhoCashOutTreemapBlocks(input);
    const total = blocks.reduce((s, b) => s + b.total, 0);
    let count = 0;
    for (const e of input.filtered) {
        if (expenseIsMarkedCofrinho(e) && e.isPaid !== false) count += 1;
    }

    return {
        total,
        essential: 0,
        creditCard: 0,
        other: total,
        count,
        essentialCount: 0,
        creditCardCount: 0,
        otherCount: count
    };
}