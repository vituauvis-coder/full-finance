import { movementDate } from '../../../lib/period';
import type { Movement } from '../../../lib/types/finance';
import {
    type CofrinhoApplication,
    type CofrinhoBucket,
    isCofrinhoPoolExpense
} from './cofrinhoAggregations';
import { expenseIsMarkedCofrinho } from './expenseLedgerBuckets';
import {
    cofrinhoBucketDeltaForMovement,
    movementPaidFromTripCofrinho,
    resolveCofrinhoBucketForMovement
} from './cofrinhoMovementLedger';
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

export function allocatedExpenseIds(applications: CofrinhoApplication[]): Set<string> {
    const ids = new Set<string>();
    for (const a of applications ?? []) {
        const raw = a as CofrinhoApplication & { allocated_expense_id?: string; allocatedExpenseId?: string };
        const id = raw.allocatedExpenseId ?? raw.allocated_expense_id;
        if (id) ids.add(String(id));
    }
    return ids;
}

/**
 * Saída espelhada da alocação (ou duplicata de aplicação) — entra no razão de Cofrinhos só pela aplicação.
 * Remove da lista de Saídas para o total não contar em dobro.
 */
export function expenseOmittedFromCofrinhoInflowAsDuplicate(
    e: Movement,
    buckets: CofrinhoBucket[],
    applications: CofrinhoApplication[]
): boolean {
    if (e.isPaid === false) return false;
    if (!isCofrinhoBucketExpense(e)) return false;
    if (allocatedExpenseIds(applications).has(String(e.id))) return true;

    const ym = movementYearMonth(e);
    if (!ym) return false;

    const resolved = resolveCofrinhoBucketForMovement(e, buckets);
    if (!resolved) return false;
    const delta = cofrinhoBucketDeltaForMovement(e, resolved);
    if (delta <= 0) return false;

    return (applications ?? []).some((a) => {
        const bId = applicationBucketId(a);
        const refYm = referenceMonthToYearMonth(applicationReferenceMonth(a));
        const appAmt = Number(a.amount) || 0;
        return bId === resolved.id && refYm === ym && Math.abs(appAmt - delta) < 0.01;
    });
}

/** Só saídas `allocated_expense` — espelho automático da distribuição pool→caixinha. */
export function isAllocatedCofrinhoMirrorExpense(
    e: Movement,
    applications: CofrinhoApplication[]
): boolean {
    return allocatedExpenseIds(applications).has(String(e.id));
}

/**
 * Base para o **card de total** em Saídas com filtro Cofrinhos (não esconde da tabela).
 * Remove apenas espelhos de alocação; mantém pool, aportes diretos e lançamentos com aplicação paralela.
 */
export function filterAllocatedCofrinhoMirrorsForSaidasTotals(
    expenses: Movement[],
    applications: CofrinhoApplication[]
): Movement[] {
    if (!applications?.length) return expenses;
    return (expenses ?? []).filter((e) => !isAllocatedCofrinhoMirrorExpense(e, applications));
}

/** Pix «debitar da meta» (já quitado na meta). Cartão parcelado (`isPaid: false`) continua na fatura em Saídas. */
export function tripMetaExpenseHiddenFromSaidasList(e: Movement): boolean {
    if (!movementPaidFromTripCofrinho(e)) return false;
    if (e.isPaid === false) return false;
    return true;
}

export function excludeTripMetaExpensesFromSaidasList(expenses: Movement[]): Movement[] {
    return (expenses ?? []).filter((e) => !tripMetaExpenseHiddenFromSaidasList(e));
}

/** Lista Saídas: remove espelhos automáticos e gastos pagos da meta da viagem. */
export function filterCofrinhoSaidasListRows(
    expenses: Movement[],
    _buckets: CofrinhoBucket[],
    applications: CofrinhoApplication[],
    _categoryCofrinhosFilterActive: boolean
): Movement[] {
    const withoutMirrors = filterAllocatedCofrinhoMirrorsForSaidasTotals(expenses, applications);
    return excludeTripMetaExpensesFromSaidasList(withoutMirrors);
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
        if (expenseOmittedFromCofrinhoInflowAsDuplicate(e, buckets, applications)) continue;

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