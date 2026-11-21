import type { Movement } from '../../../lib/types/finance';
import { movementDate } from '../../../lib/period';
import { EXPENSE_COFRINHO_CATEGORY, isCofrinhoPoolSubcategoryName } from './cofrinhoConstants';
import { referenceMonthToYearMonth, toYearMonthKey } from './cofrinhoPeriod';

export type CofrinhoBucket = {
    id: string;
    name?: string;
    colorKey?: string;
    icon?: string;
    yieldMultiplier?: number;
    sortOrder?: number;
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
};

function applicationBucketId(app: CofrinhoApplication): string {
    return String(app.bucketId ?? '');
}

export function sumApplicationsByBucket(applications: CofrinhoApplication[], bucketId: string): number {
    return (applications ?? [])
        .filter((a) => applicationBucketId(a) === bucketId)
        .reduce((s, a) => s + (Number(a.amount) || 0), 0);
}

export function sumAllocatedByBucket(
    expenses: Movement[],
    bucket: CofrinhoBucket,
    applications: CofrinhoApplication[] = []
): number {
    const fromApps = sumApplicationsByBucket(applications, bucket.id);
    if (fromApps > 0) return fromApps;
    const name = bucket.name ?? '';
    return (expenses ?? [])
        .filter(
            (e) =>
                String(e.category ?? '').trim() === EXPENSE_COFRINHO_CATEGORY &&
                String(e.subcategory ?? '').trim() === name &&
                e.isPaid !== false
        )
        .reduce((s, e) => s + (Number(e.amount) || 0), 0);
}

export function getTotalInBuckets(
    buckets: CofrinhoBucket[],
    expenses: Movement[],
    applications: CofrinhoApplication[]
): number {
    if (!buckets.length) return 0;
    return buckets.reduce((s, b) => s + sumAllocatedByBucket(expenses, b, applications), 0);
}

export function sumAllocatedInMonth(
    applications: CofrinhoApplication[],
    buckets: CofrinhoBucket[],
    yearMonth: string
): number {
    if (!yearMonth || !buckets.length) return 0;
    return buckets.reduce((sum, b) => {
        const v = (applications ?? [])
            .filter(
                (a) =>
                    applicationBucketId(a) === b.id &&
                    referenceMonthToYearMonth(a.referenceMonth) === yearMonth
            )
            .reduce((s, a) => s + (Number(a.amount) || 0), 0);
        return sum + v;
    }, 0);
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

export function getBucketGoalForYear(
    bucketGoals: CofrinhoBucketGoal[],
    bucketId: string,
    year: number
): CofrinhoBucketGoal | undefined {
    return (bucketGoals ?? []).find((g) => g.bucketId === bucketId && Number(g.year) === Number(year));
}

export function filterApplications(
    applications: CofrinhoApplication[],
    filters: { bucketId?: string; yearMonth?: string } = {}
): CofrinhoApplication[] {
    let list = [...(applications ?? [])];
    if (filters.bucketId) {
        list = list.filter((a) => applicationBucketId(a) === filters.bucketId);
    }
    if (filters.yearMonth) {
        list = list.filter((a) => referenceMonthToYearMonth(a.referenceMonth) === filters.yearMonth);
    }
    return list.sort((a, b) => {
        const da = referenceMonthToYearMonth(a.referenceMonth);
        const db = referenceMonthToYearMonth(b.referenceMonth);
        if (db !== da) return db.localeCompare(da);
        return String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? ''));
    });
}