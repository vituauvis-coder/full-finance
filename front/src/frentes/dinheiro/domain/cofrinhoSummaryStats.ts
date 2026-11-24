import { buildCofrinhoMonthlyYieldEvents } from '@motor/dinheiro/cofrinho-monthly-yield.js';
import type { Account, Movement } from '../../../lib/types/finance';
import type { CofrinhoApplication, CofrinhoBucket } from './cofrinhoAggregations';
import { collectCofrinhoInflowEvents } from './cofrinhoInflowEvents';
import type { CofrinhoTripPayloadOutflow } from './cofrinhoLedgerRows';
import { computeCofrinhoLedgerNetThroughMonth } from './cofrinhoLedgerNet';
import { monthlyBalanceBucketId } from './cofrinhoMonthlyBalances';
import type { CofrinhoMonthlyBalance } from './cofrinhoMonthlyBalances';

function roundMoney(n: number): number {
    return Math.round(n * 100) / 100;
}

export type CofrinhoSummary = {
    /** Aportes líquidos (entradas − saídas), sem rendimento de caixinha. */
    totalContributed: number;
    /** Aportes + rendimento registado nas reconciliações mensais. */
    totalAccumulated: number;
    /** Média dos aportes brutos por mês com movimento. */
    averageMonthlyContribution: number;
    /** Soma de rendimento nas reconciliações mensais. */
    totalYield: number;
};

function totalNetAllBuckets(
    buckets: CofrinhoBucket[],
    applications: CofrinhoApplication[],
    expenses: Movement[],
    accounts: Account[],
    tripPayloadOutflows: CofrinhoTripPayloadOutflow[]
): number {
    let sum = 0;
    for (const bucket of buckets ?? []) {
        sum += computeCofrinhoLedgerNetThroughMonth({
            bucketId: bucket.id,
            throughYearMonth: '9999-12',
            buckets,
            applications,
            expenses,
            accounts,
            tripPayloadOutflows
        });
    }
    return roundMoney(sum);
}

function monthlyBalancesToYieldSnapshots(monthlyBalances: CofrinhoMonthlyBalance[]) {
    return (monthlyBalances ?? []).map((b) => {
        const raw = b as CofrinhoMonthlyBalance & { reference_month?: string };
        return {
            id: b.id,
            bucketId: monthlyBalanceBucketId(b),
            referenceMonth: raw.referenceMonth ?? raw.reference_month,
            principalAmount: Number(b.principalAmount) || 0,
            balanceWithYield: Number(b.balanceWithYield) || 0,
            accountId: b.accountId
        };
    });
}

function totalYieldRegistered(monthlyBalances: CofrinhoMonthlyBalance[]): number {
    return roundMoney(
        buildCofrinhoMonthlyYieldEvents(monthlyBalancesToYieldSnapshots(monthlyBalances)).reduce(
            (s, ev) => s + (Number(ev.amount) || 0),
            0
        )
    );
}

/** Rendimento acumulado registado nas reconciliações mensais de uma caixinha. */
export function cofrinhoBucketRegisteredYield(
    bucketId: string,
    monthlyBalances: CofrinhoMonthlyBalance[] = []
): number {
    const id = String(bucketId ?? '').trim();
    if (!id) return 0;
    return roundMoney(
        buildCofrinhoMonthlyYieldEvents(monthlyBalancesToYieldSnapshots(monthlyBalances))
            .filter((ev) => String(ev.bucketId) === id)
            .reduce((s, ev) => s + (Number(ev.amount) || 0), 0)
    );
}

function averageGrossMonthlyContribution(
    buckets: CofrinhoBucket[],
    applications: CofrinhoApplication[],
    expenses: Movement[]
): number {
    const byMonth = new Map<string, number>();
    for (const ev of collectCofrinhoInflowEvents(buckets, applications, expenses)) {
        byMonth.set(ev.yearMonth, roundMoney((byMonth.get(ev.yearMonth) ?? 0) + ev.amount));
    }
    const active = [...byMonth.values()].filter((v) => v > 0.001);
    if (!active.length) return 0;
    const total = active.reduce((s, v) => s + v, 0);
    return roundMoney(total / active.length);
}

/** KPIs do hero — aportes, rendimento e média mensal (visão global). */
export function cofrinhoHeroSummary(
    buckets: CofrinhoBucket[],
    applications: CofrinhoApplication[],
    expenses: Movement[],
    monthlyBalances: CofrinhoMonthlyBalance[] = [],
    accounts: Account[] = [],
    tripPayloadOutflows: CofrinhoTripPayloadOutflow[] = []
): CofrinhoSummary {
    const totalContributed = totalNetAllBuckets(
        buckets,
        applications,
        expenses,
        accounts,
        tripPayloadOutflows
    );
    const totalYield = totalYieldRegistered(monthlyBalances);
    const totalAccumulated = roundMoney(Math.max(0, totalContributed + totalYield));

    return {
        totalContributed,
        totalAccumulated,
        averageMonthlyContribution: averageGrossMonthlyContribution(buckets, applications, expenses),
        totalYield
    };
}