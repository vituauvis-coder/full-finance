import { MONTH_NAMES } from '../../../lib/period';
import { accountName, formatMovementDate } from '../../../lib/movementList';
import type { Movement } from '../../../lib/types/finance';
import type { Account } from '../../../lib/types/finance';
import { type CofrinhoApplication, type CofrinhoBucket } from './cofrinhoAggregations';
import {
    collectCofrinhoInflowEvents,
    inflowEventMatchesScope,
    type CofrinhoInflowEvent
} from './cofrinhoInflowEvents';
import {
    cofrinhoBucketDeltaForMovement,
    movementPaidFromTripCofrinho,
    resolveCofrinhoBucketForOutflow,
    resolveViagemBucketForTrip,
    VIAGENS_EXPENSE_CATEGORY
} from './cofrinhoMovementLedger';
import { toYearMonthKey } from './cofrinhoPeriod';
import { movementDate } from '../../../lib/period';
import type { CofrinhoPeriodScope } from './cofrinhoPeriodScope';

/** Gasto “Debitar da meta” no orçamento da viagem (payload). */
export type CofrinhoTripPayloadOutflow = {
    tripId: string;
    tripTitle?: string;
    tripExpenseId: string;
    financeExpenseId?: string;
    amount: number;
    description: string;
    spentOn?: string;
    accountId?: string;
};

export type CofrinhoLedgerRow = {
    id: string;
    kind: 'in' | 'out';
    yearMonth: string;
    sortAt: string;
    refLabel: string;
    dateLabel: string;
    bucketId: string;
    bucketName: string;
    accountLabel: string;
    accountId?: string;
    amount: number;
    title: string;
    deletable: boolean;
    applicationId?: string;
    /** Saída espelhada no Dinheiro — editar conta via batch. */
    expenseId?: string;
    /** Data do registro (YYYY-MM-DD). */
    recordDate: string;
    editable: boolean;
};

function bucketName(buckets: CofrinhoBucket[], id: string): string {
    return buckets.find((b) => b.id === id)?.name?.trim() || 'Caixinha';
}

function refMonthLabel(ym: string): string {
    if (!ym || !/^\d{4}-\d{2}$/.test(ym)) return '—';
    const [y, m] = ym.split('-');
    const mi = Math.min(11, Math.max(0, parseInt(m, 10) - 1));
    return `${MONTH_NAMES[mi]}/${y}`;
}

function dateIsoFromMovement(m?: Movement): string {
    if (!m?.date) return '';
    if (typeof m.date === 'string' && m.date.trim()) {
        const hit = m.date.trim().match(/^(\d{4}-\d{2}-\d{2})/);
        if (hit) return hit[1];
    }
    try {
        return movementDate(m).toISOString().slice(0, 10);
    } catch {
        return '';
    }
}

function recordDateForInflow(
    ev: CofrinhoInflowEvent,
    expenses: Movement[],
    applications: CofrinhoApplication[]
): string {
    if (ev.expenseId) {
        const iso = dateIsoFromMovement(expenses.find((e) => String(e.id) === String(ev.expenseId)));
        if (iso) return iso;
    }
    if (ev.applicationId) {
        const app = applications.find((a) => String(a.id) === String(ev.applicationId));
        const allocId =
            (app as { allocatedExpenseId?: string; allocated_expense_id?: string } | undefined)
                ?.allocatedExpenseId ??
            (app as { allocated_expense_id?: string } | undefined)?.allocated_expense_id;
        if (allocId) {
            const iso = dateIsoFromMovement(expenses.find((e) => String(e.id) === String(allocId)));
            if (iso) return iso;
        }
    }
    const raw = String(ev.sortAt ?? '').slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    return '';
}

function inflowToRow(
    ev: CofrinhoInflowEvent,
    buckets: CofrinhoBucket[],
    accounts: Account[],
    expenses: Movement[],
    applications: CofrinhoApplication[]
): CofrinhoLedgerRow {
    const recordDate = recordDateForInflow(ev, expenses, applications);
    const referenceYm = ev.yearMonth;
    const editable = Boolean(ev.applicationId || ev.expenseId);
    return {
        id: ev.id,
        kind: 'in',
        yearMonth: referenceYm,
        sortAt: recordDate || ev.sortAt,
        refLabel: refMonthLabel(referenceYm),
        dateLabel: formatMovementDate({ date: recordDate || ev.sortAt }),
        bucketId: ev.bucketId,
        bucketName: bucketName(buckets, ev.bucketId),
        accountLabel: accountName(accounts, ev.accountId),
        accountId: ev.accountId ? String(ev.accountId) : undefined,
        amount: ev.amount,
        title: ev.title,
        deletable: ev.deletable,
        applicationId: ev.applicationId,
        expenseId: ev.expenseId ? String(ev.expenseId) : undefined,
        recordDate: recordDate || String(ev.sortAt).slice(0, 10) || '',
        editable
    };
}

function movementYearMonth(e: Movement): string {
    const d = e.date;
    if (typeof d === 'string' && d.trim()) return toYearMonthKey(d);
    try {
        return toYearMonthKey(movementDate(e).toISOString());
    } catch {
        return '';
    }
}

function movementMatchesScope(e: Movement, scope: CofrinhoPeriodScope): boolean {
    const ym = movementYearMonth(e);
    if (!ym) return false;
    if (scope.kind === 'all-years') return true;
    if (scope.kind === 'civil-year') return ym.startsWith(`${scope.year}-`);
    return ym === scope.yearMonth;
}

function movementFinanceTripExpenseId(m: Movement): string {
    const raw = m as Movement & { trip_expense_id?: string };
    return String(m.tripExpenseId ?? raw.trip_expense_id ?? '').trim();
}

function movementTripIdFromExpense(m: Movement): string {
    const raw = m as Movement & { trip_id?: string };
    return String(m.tripId ?? raw.trip_id ?? '').trim();
}

function payloadMarksCofrinhoOutflow(
    m: Movement,
    tripPayloadOutflows: CofrinhoTripPayloadOutflow[]
): CofrinhoTripPayloadOutflow | undefined {
    const financeId = String(m.id);
    const tripExpenseId = movementFinanceTripExpenseId(m);
    const tripId = movementTripIdFromExpense(m);
    return tripPayloadOutflows.find(
        (t) =>
            (t.financeExpenseId && t.financeExpenseId === financeId) ||
            (tripExpenseId &&
                t.tripExpenseId === tripExpenseId &&
                (!tripId || !t.tripId || t.tripId === tripId))
    );
}

function outflowRowAlreadyListed(
    rows: CofrinhoLedgerRow[],
    bucketId: string,
    hint: { financeExpenseId?: string; tripExpenseId?: string; tripId?: string },
    expenses: Movement[] = []
): boolean {
    const financeExpenseId = hint.financeExpenseId ? String(hint.financeExpenseId).trim() : '';
    if (financeExpenseId && rows.some((r) => r.expenseId === financeExpenseId)) return true;
    if (financeExpenseId) {
        const legacyId = `exp-out-${financeExpenseId}-${bucketId}`;
        if (rows.some((r) => r.id === legacyId)) return true;
    }

    const tripExpenseId = hint.tripExpenseId ? String(hint.tripExpenseId).trim() : '';
    const hintTripId = hint.tripId ? String(hint.tripId).trim() : '';

    if (tripExpenseId) {
        if (rows.some((r) => r.id === `trip-out-${tripExpenseId}-${bucketId}`)) return true;
        if (
            rows.some((r) => {
                if (r.kind !== 'out' || !r.expenseId) return false;
                const exp = expenses.find((e) => String(e.id) === r.expenseId);
                if (!exp) return false;
                if (movementFinanceTripExpenseId(exp) !== tripExpenseId) return false;
                const expTripId = movementTripIdFromExpense(exp);
                if (hintTripId && expTripId && expTripId !== hintTripId) return false;
                return true;
            })
        ) {
            return true;
        }
    }

    return false;
}

/** Remove saídas espelhadas 2× (expenses + payload da viagem). */
function dedupeCofrinhoOutflowRows(rows: CofrinhoLedgerRow[], expenses: Movement[]): CofrinhoLedgerRow[] {
    const seenFinance = new Set<string>();
    const seenTripExpense = new Set<string>();

    return rows.filter((r) => {
        if (r.kind !== 'out') return true;

        if (r.expenseId) {
            const id = String(r.expenseId);
            if (seenFinance.has(id)) return false;
            seenFinance.add(id);
            const exp = expenses.find((e) => String(e.id) === id);
            const tripExpId = exp ? movementFinanceTripExpenseId(exp) : '';
            if (tripExpId) seenTripExpense.add(`${tripExpId}|${r.bucketId}`);
        }

        const tripOut = r.id.match(/^trip-out-(.+)-(.+)$/);
        if (tripOut) {
            const key = `${tripOut[1]}|${tripOut[2]}`;
            if (seenTripExpense.has(key)) return false;
            seenTripExpense.add(key);
        }

        return true;
    });
}

function yearMonthFromIsoDate(iso: string): string {
    const d = String(iso ?? '').trim().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return '';
    return d.slice(0, 7);
}

function tripOutflowMatchesScope(spentOn: string | undefined, scope: CofrinhoPeriodScope): boolean {
    const ym = yearMonthFromIsoDate(String(spentOn ?? ''));
    if (!ym) return scope.kind === 'all-years';
    if (scope.kind === 'all-years') return true;
    if (scope.kind === 'civil-year') return ym.startsWith(`${scope.year}-`);
    return ym === scope.yearMonth;
}

export function buildCofrinhoLedgerRows(
    expenses: Movement[],
    applications: CofrinhoApplication[],
    buckets: CofrinhoBucket[],
    accounts: Account[],
    scope: CofrinhoPeriodScope,
    tripPayloadOutflows: CofrinhoTripPayloadOutflow[] = []
): CofrinhoLedgerRow[] {
    const inflowEvents = collectCofrinhoInflowEvents(buckets, applications, expenses).filter((ev) =>
        inflowEventMatchesScope(ev, scope)
    );

    const rows: CofrinhoLedgerRow[] = inflowEvents.map((ev) =>
        inflowToRow(ev, buckets, accounts, expenses, applications)
    );

    for (const e of expenses ?? []) {
        if (e.isPaid === false) continue;
        if (!movementMatchesScope(e, scope)) continue;
        if (String(e.category ?? '').trim() !== VIAGENS_EXPENSE_CATEGORY) continue;

        const payloadHint = payloadMarksCofrinhoOutflow(e, tripPayloadOutflows);
        const paidFromCofrinho = movementPaidFromTripCofrinho(e) || Boolean(payloadHint);
        if (!paidFromCofrinho) continue;

        let bucket =
            resolveCofrinhoBucketForOutflow(e, buckets) ??
            (payloadHint
                ? resolveViagemBucketForTrip(payloadHint.tripId, payloadHint.tripTitle, buckets)
                : null);
        if (!bucket) {
            bucket = resolveViagemBucketForTrip(
                movementTripIdFromExpense(e),
                e.subcategory,
                buckets
            );
        }
        if (!bucket) continue;

        const delta = movementPaidFromTripCofrinho(e)
            ? cofrinhoBucketDeltaForMovement(e, bucket)
            : -Math.max(0, Number(e.amount) || 0);
        if (delta >= 0) continue;

        if (
            outflowRowAlreadyListed(
                rows,
                bucket.id,
                {
                    financeExpenseId: String(e.id),
                    tripExpenseId: movementFinanceTripExpenseId(e) || payloadHint?.tripExpenseId,
                    tripId: movementTripIdFromExpense(e) || payloadHint?.tripId
                },
                expenses
            )
        ) {
            continue;
        }

        const ym = movementYearMonth(e);
        const recordDate = dateIsoFromMovement(e) || ym + '-01';
        rows.push({
            id: `exp-out-${e.id}-${bucket.id}`,
            kind: 'out',
            yearMonth: ym,
            sortAt: recordDate,
            refLabel: refMonthLabel(ym),
            dateLabel: formatMovementDate(e),
            bucketId: bucket.id,
            bucketName: bucket.name ?? 'Caixinha',
            accountLabel: accountName(accounts, e.accountId),
            accountId: e.accountId ? String(e.accountId) : undefined,
            amount: Math.abs(delta),
            title: String(e.description ?? 'Gasto do cofrinho').trim() || 'Gasto do cofrinho',
            deletable: false,
            expenseId: String(e.id),
            recordDate,
            editable: false
        });
    }

    for (const t of tripPayloadOutflows ?? []) {
        const tripId = String(t.tripId ?? '').trim();
        if (!tripId) continue;
        const bucket = resolveViagemBucketForTrip(tripId, t.tripTitle, buckets);
        if (!bucket) continue;
        if (!tripOutflowMatchesScope(t.spentOn, scope)) continue;

        if (
            outflowRowAlreadyListed(
                rows,
                bucket.id,
                {
                    financeExpenseId: t.financeExpenseId,
                    tripExpenseId: t.tripExpenseId,
                    tripId
                },
                expenses
            )
        ) {
            continue;
        }

        const recordDate = String(t.spentOn ?? '').trim().slice(0, 10);
        const ym = yearMonthFromIsoDate(recordDate) || movementYearMonth({ date: recordDate } as Movement);
        if (!ym && scope.kind !== 'all-years') continue;

        const amount = Math.max(0, Number(t.amount) || 0);
        if (amount <= 0) continue;

        rows.push({
            id: `trip-out-${t.tripExpenseId}-${bucket.id}`,
            kind: 'out',
            yearMonth: ym || '0000-00',
            sortAt: recordDate || `${ym || '0000-00'}-01`,
            refLabel: ym ? refMonthLabel(ym) : '—',
            dateLabel: recordDate ? formatMovementDate({ date: recordDate }) : '—',
            bucketId: bucket.id,
            bucketName: bucket.name ?? 'Caixinha',
            accountLabel: accountName(accounts, t.accountId),
            accountId: t.accountId ? String(t.accountId) : undefined,
            amount,
            title: String(t.description ?? 'Gasto do cofrinho').trim() || 'Gasto do cofrinho',
            deletable: false,
            expenseId: t.financeExpenseId,
            recordDate: recordDate || '',
            editable: false
        });
    }

    return dedupeCofrinhoOutflowRows(rows, expenses).sort((a, b) =>
        String(b.sortAt).localeCompare(String(a.sortAt))
    );
}