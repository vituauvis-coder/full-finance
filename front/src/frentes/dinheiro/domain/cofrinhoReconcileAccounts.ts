import type { Account } from '../../../lib/types/finance';
import type { Movement } from '../../../lib/types/finance';
import type { CofrinhoApplication, CofrinhoBucket } from './cofrinhoAggregations';
import { buildCofrinhoLedgerRows, type CofrinhoTripPayloadOutflow } from './cofrinhoLedgerRows';
import { resolveLedgerRowAccountId } from './cofrinhoLedgerNet';
import type { CofrinhoPeriodScope } from './cofrinhoPeriodScope';
import {
    monthlyBalanceAccountId,
    monthlyBalanceBucketId,
    monthlyBalanceYearMonth,
    type CofrinhoMonthlyBalance
} from './cofrinhoMonthlyBalances';

const ALL_YEARS_SCOPE: CofrinhoPeriodScope = { kind: 'all-years' };

export function monthlyBalancesForBucketMonth(
    balances: CofrinhoMonthlyBalance[],
    bucketId: string,
    yearMonth: string
): CofrinhoMonthlyBalance[] {
    return (balances ?? []).filter(
        (b) => monthlyBalanceBucketId(b) === bucketId && monthlyBalanceYearMonth(b) === yearMonth
    );
}

/** Contas que já aportaram nesta caixinha ou já têm saldo registrado no mês. */
export function accountIdsForBucketReconcile(
    bucketId: string,
    buckets: CofrinhoBucket[],
    applications: CofrinhoApplication[],
    expenses: Movement[],
    monthlyBalances: CofrinhoMonthlyBalance[],
    yearMonth: string,
    accounts: Account[] = [],
    tripPayloadOutflows: CofrinhoTripPayloadOutflow[] = []
): string[] {
    const ids = new Set<string>();

    const ledgerRows = buildCofrinhoLedgerRows(
        expenses,
        applications,
        buckets,
        accounts,
        ALL_YEARS_SCOPE,
        tripPayloadOutflows
    );
    for (const row of ledgerRows) {
        if (row.bucketId !== bucketId || row.kind !== 'in') continue;
        const aid = resolveLedgerRowAccountId(row, expenses, applications);
        if (aid) ids.add(aid);
    }

    for (const row of monthlyBalancesForBucketMonth(monthlyBalances, bucketId, yearMonth)) {
        const aid = monthlyBalanceAccountId(row);
        if (aid) ids.add(aid);
    }

    const legacy = monthlyBalancesForBucketMonth(monthlyBalances, bucketId, yearMonth).find(
        (row) => !monthlyBalanceAccountId(row)
    );
    if (legacy && ids.size === 0) {
        return [''];
    }

    return [...ids];
}

export function accountLabel(accounts: Account[], accountId: string): string {
    if (!accountId) return 'Conta';
    return accounts.find((a) => a.id === accountId)?.name?.trim() || 'Conta';
}