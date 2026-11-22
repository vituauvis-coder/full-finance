import { movementDate } from '../../../lib/period';
import type { Movement } from '../../../lib/types/finance';
import {
    type CofrinhoApplication,
    type CofrinhoBucket,
    isCofrinhoPoolExpense
} from './cofrinhoAggregations';
import { expenseIsMarkedCofrinho } from './expenseLedgerBuckets';
import { cofrinhoBucketDeltaForMovement, resolveCofrinhoBucketForMovement } from './cofrinhoMovementLedger';
import { referenceMonthToYearMonth, toYearMonthKey } from './cofrinhoPeriod';
import type { CofrinhoPeriodScope } from './cofrinhoPeriodScope';

export type CofrinhoInflowEvent = {
    id: string;
    bucketId: string;
    yearMonth: string;
    amount: number;
    source: 'application' | 'expense';
    sortAt: string;
    accountId?: string;
    title: string;
    applicationId?: string;
    expenseId?: string;
    deletable: boolean;
};

function applicationBucketId(app: CofrinhoApplication): string {
    const raw = app as CofrinhoApplication & { bucket_id?: string };
    return String(app.bucketId ?? raw.bucket_id ?? '');
}

function applicationReferenceMonth(app: CofrinhoApplication): string {
    const raw = app as CofrinhoApplication & { reference_month?: string };
    return String(app.referenceMonth ?? raw.reference_month ?? '');
}

function applicationCreatedAt(app: CofrinhoApplication): string {
    const raw = app as CofrinhoApplication & { created_at?: string };
    return String(app.createdAt ?? raw.created_at ?? '');
}

function allocatedExpenseIds(applications: CofrinhoApplication[]): Set<string> {
    const ids = new Set<string>();
    for (const a of applications ?? []) {
        const raw = a as CofrinhoApplication & { allocated_expense_id?: string; allocatedExpenseId?: string };
        const id = raw.allocatedExpenseId ?? raw.allocated_expense_id;
        if (id) ids.add(String(id));
    }
    return ids;
}

function movementYearMonth(e: Movement): string {
    const d = e.date;
    if (typeof d === 'string' && d.trim()) {
        return toYearMonthKey(d);
    }
    try {
        return toYearMonthKey(movementDate(e).toISOString());
    } catch {
        return '';
    }
}

function isCofrinhoBucketExpense(e: Movement): boolean {
    if (!expenseIsMarkedCofrinho(e)) return false;
    if (isCofrinhoPoolExpense(e)) return false;
    return true;
}

export function collectCofrinhoInflowEvents(
    buckets: CofrinhoBucket[],
    applications: CofrinhoApplication[],
    expenses: Movement[]
): CofrinhoInflowEvent[] {
    const events: CofrinhoInflowEvent[] = [];
    const mirroredExpenseIds = allocatedExpenseIds(applications);
    const bucketIds = new Set(buckets.map((b) => b.id));

    for (const app of applications ?? []) {
        const bucketId = applicationBucketId(app);
        if (!bucketId || !bucketIds.has(bucketId)) continue;
        const ym = referenceMonthToYearMonth(applicationReferenceMonth(app));
        if (!ym) continue;
        const amount = Number(app.amount) || 0;
        if (amount <= 0) continue;
        const created = applicationCreatedAt(app);
        events.push({
            id: `app-${app.id}`,
            bucketId,
            yearMonth: ym,
            amount,
            source: 'application',
            sortAt: created || `${ym}-15`,
            accountId: app.accountId,
            title: 'Aporte (distribuição)',
            applicationId: app.id,
            deletable: true
        });
    }

    for (const e of expenses ?? []) {
        if (e.isPaid === false) continue;
        if (!isCofrinhoBucketExpense(e)) continue;
        if (mirroredExpenseIds.has(String(e.id))) continue;

        const ym = movementYearMonth(e);
        if (!ym) continue;

        const resolved = resolveCofrinhoBucketForMovement(e, buckets);
        if (!resolved) continue;
        const delta = cofrinhoBucketDeltaForMovement(e, resolved);
        if (delta <= 0) continue;
            events.push({
                id: `exp-in-${e.id}-${resolved.id}`,
                bucketId: resolved.id,
                yearMonth: ym,
                amount: delta,
                source: 'expense',
                sortAt: String(e.date ?? e.createdAt ?? ym),
                accountId: e.accountId,
                title: String(e.description ?? 'Aporte direto').trim() || 'Aporte direto',
                expenseId: String(e.id),
                deletable: false
            });
    }

    return events;
}

export function inflowEventMatchesScope(event: CofrinhoInflowEvent, scope: CofrinhoPeriodScope): boolean {
    if (scope.kind === 'all-years') return true;
    if (scope.kind === 'civil-year') return event.yearMonth.startsWith(`${scope.year}-`);
    return event.yearMonth === scope.yearMonth;
}

export function inflowEventMatchesYear(event: CofrinhoInflowEvent, year: number): boolean {
    return event.yearMonth.startsWith(`${year}-`);
}

export function sumInflowEventsForBucket(
    events: CofrinhoInflowEvent[],
    bucketId: string,
    filter?: { year?: number; yearMonth?: string }
): number {
    return events
        .filter((ev) => {
            if (ev.bucketId !== bucketId) return false;
            if (filter?.year != null && !ev.yearMonth.startsWith(`${filter.year}-`)) return false;
            if (filter?.yearMonth && ev.yearMonth !== filter.yearMonth) return false;
            return true;
        })
        .reduce((s, ev) => s + ev.amount, 0);
}