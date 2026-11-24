import type { Movement } from '../../../lib/types/finance';
import { movementDate } from '../../../lib/period';
import { EXPENSE_COFRINHO_CATEGORY, isCofrinhoPoolSubcategoryName } from './cofrinhoConstants';
import { collectCofrinhoInflowEvents, sumInflowEventsForBucket } from './cofrinhoInflowEvents';
import { cofrinhoBucketDeltaForMovement } from './cofrinhoMovementLedger';
import { referenceMonthToYearMonth, toYearMonthKey } from './cofrinhoPeriod';

export type CofrinhoBucketKind = 'reserve' | 'viagem' | 'pool';

export type CofrinhoBucket = {
    id: string;
    name?: string;
    colorKey?: string;
    icon?: string;
    yieldMultiplier?: number;
    sortOrder?: number;
    kind?: CofrinhoBucketKind | string;
    tripId?: string | null;
};

export type CofrinhoApplication = {
    id: string;
    bucketId?: string;
    referenceMonth?: string;
    amount?: number;
    accountId?: string;
    createdAt?: string;
};

export type CofrinhoBucketGoal = {
    id: string;
    bucketId?: string;
    year?: number;
    targetAmount?: number;
    achievedAmount?: number;
    /** Prazo para atingir a meta (YYYY-MM-DD). */
    targetDeadline?: string | null;
};

function applicationBucketId(app: CofrinhoApplication): string {
    const raw = app as CofrinhoApplication & { bucket_id?: string };
    return String(app.bucketId ?? raw.bucket_id ?? '');
}

export function sumApplicationsByBucket(applications: CofrinhoApplication[], bucketId: string): number {
    return (applications ?? [])
        .filter((a) => applicationBucketId(a) === bucketId)
        .reduce((s, a) => s + (Number(a.amount) || 0), 0);
}

export function sumAllocatedByBucket(
    expenses: Movement[],
    bucket: CofrinhoBucket,
    applications: CofrinhoApplication[] = [],
    buckets: CofrinhoBucket[] = []
): number {
    const pool = buckets.length ? buckets : [bucket];
    const events = collectCofrinhoInflowEvents(pool, applications, expenses);
    return Math.round(sumInflowEventsForBucket(events, bucket.id) * 100) / 100;
}

export function getTotalInBuckets(
    buckets: CofrinhoBucket[],
    expenses: Movement[],
    applications: CofrinhoApplication[]
): number {
    if (!buckets.length) return 0;
    return buckets.reduce((s, b) => s + sumAllocatedByBucket(expenses, b, applications, buckets), 0);
}

export function sumAllocatedInMonth(
    applications: CofrinhoApplication[],
    buckets: CofrinhoBucket[],
    yearMonth: string,
    expenses: Movement[] = []
): number {
    if (!yearMonth || !buckets.length) return 0;
    const events = collectCofrinhoInflowEvents(buckets, applications, expenses);
    const total = events
        .filter((ev) => ev.yearMonth === yearMonth)
        .reduce((s, ev) => s + ev.amount, 0);
    return Math.round(total * 100) / 100;
}

export function isCofrinhoPoolExpense(expense: Movement): boolean {
    if (String(expense.category ?? '').trim() !== EXPENSE_COFRINHO_CATEGORY) return false;
    return isCofrinhoPoolSubcategoryName(expense.subcategory);
}

export function sumCofrinhoPoolForMonth(expenses: Movement[], yearMonth: string): number {
    if (!yearMonth) return 0;
    return (expenses ?? []).reduce((sum, e) => {
        if (!isCofrinhoPoolExpense(e)) return sum;
        if (e.isPaid === false) return sum;
        const ym = toYearMonthKey(
            typeof e.date === 'string' ? e.date : movementDate(e).toISOString()
        );
        if (ym !== yearMonth) return sum;
        return sum + (Number(e.amount) || 0);
    }, 0);
}

export function computePendingBalance(expenses: Movement[], yearMonth: string): number {
    const raw = sumCofrinhoPoolForMonth(expenses, yearMonth);
    return Math.max(0, Math.round(raw * 100) / 100);
}

export function sumCofrinhoPoolForCivilYear(expenses: Movement[], year: number): number {
    const prefix = `${year}-`;
    return (expenses ?? []).reduce((sum, e) => {
        if (!isCofrinhoPoolExpense(e) || e.isPaid === false) return sum;
        const ym = toYearMonthKey(typeof e.date === 'string' ? e.date : movementDate(e).toISOString());
        if (!ym.startsWith(prefix)) return sum;
        return sum + (Number(e.amount) || 0);
    }, 0);
}

export function sumCofrinhoPoolAllYears(expenses: Movement[]): number {
    return (expenses ?? []).reduce((sum, e) => {
        if (!isCofrinhoPoolExpense(e) || e.isPaid === false) return sum;
        return sum + (Number(e.amount) || 0);
    }, 0);
}

function goalBucketId(g: CofrinhoBucketGoal): string {
    const raw = g as CofrinhoBucketGoal & { bucket_id?: string };
    return String(g.bucketId ?? raw.bucket_id ?? '');
}

export function getBucketGoalForYear(
    bucketGoals: CofrinhoBucketGoal[],
    bucketId: string,
    year: number
): CofrinhoBucketGoal | undefined {
    const bid = String(bucketId);
    return (bucketGoals ?? []).find((g) => goalBucketId(g) === bid && Number(g.year) === Number(year));
}

export function filterApplications(
    applications: CofrinhoApplication[],
    filters: { bucketId?: string; yearMonth?: string; civilYear?: number; allYears?: boolean } = {}
): CofrinhoApplication[] {
    let list = [...(applications ?? [])];
    if (filters.bucketId) {
        list = list.filter((a) => applicationBucketId(a) === filters.bucketId);
    }
    if (filters.allYears) {
        // sem recorte temporal
    } else if (filters.civilYear != null) {
        const prefix = `${filters.civilYear}-`;
        list = list.filter((a) => referenceMonthToYearMonth(a.referenceMonth).startsWith(prefix));
    } else     if (filters.yearMonth) {
        list = list.filter((a) => {
            const raw = a as CofrinhoApplication & { reference_month?: string };
            return referenceMonthToYearMonth(a.referenceMonth ?? raw.reference_month) === filters.yearMonth;
        });
    }
    return list.sort((a, b) => {
        const ref = (x: CofrinhoApplication) => {
            const raw = x as CofrinhoApplication & { reference_month?: string };
            return referenceMonthToYearMonth(x.referenceMonth ?? raw.reference_month);
        };
        const da = ref(a);
        const db = ref(b);
        if (db !== da) return db.localeCompare(da);
        return String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? ''));
    });
}