import { buildCofrinhoMonthlyYieldEvents } from '@motor/dinheiro/cofrinho-monthly-yield.js';
import { formatMovementDate } from '../../../lib/movementList';
import type { CofrinhoLedgerRow } from './cofrinhoLedgerRows';
import type { CofrinhoBucket } from './cofrinhoAggregations';
import { MONTH_NAMES } from '../../../lib/period';
import type { CofrinhoMonthlyBalance } from './cofrinhoMonthlyBalances';
import { monthlyBalanceAccountId, monthlyBalanceBucketId, monthlyBalanceYearMonth } from './cofrinhoMonthlyBalances';
import type { CofrinhoPeriodScope } from './cofrinhoPeriodScope';

function refMonthLabel(ym: string): string {
    if (!ym || !/^\d{4}-\d{2}$/.test(ym)) return '—';
    const [y, m] = ym.split('-');
    const mi = Math.min(11, Math.max(0, parseInt(m, 10) - 1));
    return `${MONTH_NAMES[mi]}/${y}`;
}

function lastDayOfYearMonth(ym: string): string {
    const [y, m] = ym.split('-').map(Number);
    if (!Number.isFinite(y) || !Number.isFinite(m)) return `${ym}-28`;
    const last = new Date(y, m, 0).getDate();
    return `${y}-${String(m).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
}

function yieldEventMatchesScope(yearMonth: string, scope: CofrinhoPeriodScope): boolean {
    if (scope.kind === 'all-years') return true;
    if (scope.kind === 'civil-year') return yearMonth.startsWith(`${scope.year}-`);
    return yearMonth === scope.yearMonth;
}

function bucketName(buckets: CofrinhoBucket[], id: string): string {
    return buckets.find((b) => b.id === id)?.name?.trim() || 'Caixinha';
}

export function buildCofrinhoYieldLedgerRows(
    balances: CofrinhoMonthlyBalance[],
    buckets: CofrinhoBucket[],
    scope: CofrinhoPeriodScope
): CofrinhoLedgerRow[] {
    const events = buildCofrinhoMonthlyYieldEvents(
        (balances ?? []).map((b) => {
            const raw = b as CofrinhoMonthlyBalance & { reference_month?: string };
            return {
                id: b.id,
                bucketId: monthlyBalanceBucketId(b),
                referenceMonth: raw.referenceMonth ?? raw.reference_month,
                principalAmount: Number(b.principalAmount) || 0,
                balanceWithYield: Number(b.balanceWithYield) || 0
            };
        })
    );

    return events
        .filter((ev) => yieldEventMatchesScope(ev.yearMonth, scope))
        .map((ev): CofrinhoLedgerRow => {
            const recordDate = lastDayOfYearMonth(ev.yearMonth);
            return {
                id: ev.id,
                kind: 'in',
                yearMonth: ev.yearMonth,
                sortAt: recordDate,
                refLabel: refMonthLabel(ev.yearMonth),
                dateLabel: formatMovementDate({ date: recordDate }),
                bucketId: ev.bucketId,
                bucketName: bucketName(buckets, ev.bucketId),
                accountLabel: '—',
                amount: ev.amount,
                title: 'Rendimento',
                deletable: Boolean(ev.yieldMonthKey || ev.snapshotId),
                editable: false,
                recordDate,
                yieldSnapshotId: ev.snapshotId,
                yieldMonthKey: ev.yieldMonthKey,
                isYield: true
            };
        });
}

export function mergeCofrinhoLedgerWithYield(
    base: CofrinhoLedgerRow[],
    balances: CofrinhoMonthlyBalance[],
    buckets: CofrinhoBucket[],
    scope: CofrinhoPeriodScope
): CofrinhoLedgerRow[] {
    const yieldRows = buildCofrinhoYieldLedgerRows(balances, buckets, scope);
    return [...base, ...yieldRows].sort((a, b) => String(b.sortAt).localeCompare(String(a.sortAt)));
}

function roundMoney(n: number): number {
    return Math.round(n * 100) / 100;
}

/**
 * Rendimento por conta de pagamento — cada snapshot mensal na caixinha (reconciliação).
 * Não reparte rendimento para quem só aportou no passado; segue o saldo registrado na conta.
 */
export function perAccountYieldFromMonthlyBalances(
    monthlyBalances: CofrinhoMonthlyBalance[],
    ledgerAccountId: string
): { total: number; byMonth: Map<string, number> } {
    const target = String(ledgerAccountId ?? '').trim();
    if (!target) return { total: 0, byMonth: new Map() };

    const rows = (monthlyBalances ?? []).filter((b) => monthlyBalanceAccountId(b) === target);
    const byBucket = new Map<string, CofrinhoMonthlyBalance[]>();
    for (const row of rows) {
        const bid = monthlyBalanceBucketId(row);
        if (!bid) continue;
        const list = byBucket.get(bid) ?? [];
        list.push(row);
        byBucket.set(bid, list);
    }

    let total = 0;
    const byMonth = new Map<string, number>();

    for (const list of byBucket.values()) {
        const sorted = [...list].sort((a, b) =>
            monthlyBalanceYearMonth(a).localeCompare(monthlyBalanceYearMonth(b))
        );
        let prevCumulative = 0;
        for (const snap of sorted) {
            const ym = monthlyBalanceYearMonth(snap);
            if (!ym) continue;
            const principal = Number(snap.principalAmount) || 0;
            const balance = Number(snap.balanceWithYield) || 0;
            const cumulative = Math.max(0, roundMoney(balance - principal));
            const monthly = roundMoney(cumulative - prevCumulative);
            if (monthly >= 0.005) {
                total += monthly;
                byMonth.set(ym, roundMoney((byMonth.get(ym) ?? 0) + monthly));
            }
            prevCumulative = cumulative;
        }
    }

    return { total: roundMoney(total), byMonth };
}