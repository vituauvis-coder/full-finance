import type { Account, Movement } from '../../../lib/types/finance';
import type { CofrinhoApplication, CofrinhoBucket } from './cofrinhoAggregations';
import type { CofrinhoTripPayloadOutflow } from './cofrinhoLedgerRows';
import {
    computeCofrinhoLedgerMonthTotals,
    computeCofrinhoLedgerNetThroughMonth,
    type CofrinhoLedgerMonthTotals
} from './cofrinhoLedgerNet';

function ledgerOpts(
    bucket: CofrinhoBucket,
    buckets: CofrinhoBucket[],
    applications: CofrinhoApplication[],
    expenses: Movement[],
    yearMonth: string,
    accountId: string | undefined,
    accounts: Account[],
    tripPayloadOutflows: CofrinhoTripPayloadOutflow[]
) {
    return {
        bucketId: bucket.id,
        throughYearMonth: yearMonth,
        accountId,
        buckets,
        applications,
        expenses,
        accounts,
        tripPayloadOutflows
    };
}

export function cofrinhoLedgerMonthTotals(
    bucket: CofrinhoBucket,
    buckets: CofrinhoBucket[],
    applications: CofrinhoApplication[],
    expenses: Movement[],
    yearMonth: string,
    accountId: string | undefined,
    accounts: Account[],
    tripPayloadOutflows: CofrinhoTripPayloadOutflow[] = []
): CofrinhoLedgerMonthTotals {
    return computeCofrinhoLedgerMonthTotals({
        ...ledgerOpts(
            bucket,
            buckets,
            applications,
            expenses,
            yearMonth,
            accountId,
            accounts,
            tripPayloadOutflows
        ),
        yearMonth
    });
}

export function computeCofrinhoPrincipalThroughMonth(
    bucket: CofrinhoBucket,
    buckets: CofrinhoBucket[],
    applications: CofrinhoApplication[],
    expenses: Movement[],
    yearMonth: string,
    accountId?: string,
    accounts: Account[] = [],
    tripPayloadOutflows: CofrinhoTripPayloadOutflow[] = []
): number {
    return computeCofrinhoLedgerNetThroughMonth(
        ledgerOpts(
            bucket,
            buckets,
            applications,
            expenses,
            yearMonth,
            accountId,
            accounts,
            tripPayloadOutflows
        )
    );
}

/** Aportes no mês antes das saídas (fim do mês anterior + entradas do mês). */
export function computeCofrinhoPrincipalBeforeOutflowsInMonth(
    bucket: CofrinhoBucket,
    buckets: CofrinhoBucket[],
    applications: CofrinhoApplication[],
    expenses: Movement[],
    yearMonth: string,
    accountId?: string,
    accounts: Account[] = [],
    tripPayloadOutflows: CofrinhoTripPayloadOutflow[] = []
): number {
    return cofrinhoLedgerMonthTotals(
        bucket,
        buckets,
        applications,
        expenses,
        yearMonth,
        accountId,
        accounts,
        tripPayloadOutflows
    ).principalBeforeOutflows;
}