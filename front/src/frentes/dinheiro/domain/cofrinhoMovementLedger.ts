import type { Movement } from '../../../lib/types/finance';
import type { CofrinhoBucket } from './cofrinhoAggregations';
import {
    COFRINHO_POOL_SUBCATEGORY,
    EXPENSE_COFRINHO_CATEGORY,
    isCofrinhoPoolSubcategoryName
} from './cofrinhoConstants';

export const VIAGENS_EXPENSE_CATEGORY = 'Viagens';

export const COFRINHO_BUCKET_KIND_RESERVE = 'reserve';
export const COFRINHO_BUCKET_KIND_VIAGEM = 'viagem';

export function movementPaidFromTripCofrinho(m: Movement): boolean {
    const v = (m as Movement & { paid_from_cofrinho?: boolean }).paidFromCofrinho ?? (m as Movement & { paid_from_cofrinho?: boolean }).paid_from_cofrinho;
    return v === true || v === 'true' || v === 1 || v === '1';
}

export function movementSkipsAccountCashOut(m: Movement): boolean {
    return movementPaidFromTripCofrinho(m);
}

function movementTripId(m: Movement): string {
    const raw = m as Movement & { trip_id?: string };
    return String(m.tripId ?? raw.trip_id ?? '').trim();
}

function bucketTripId(bucket: CofrinhoBucket): string {
    const raw = bucket as CofrinhoBucket & { trip_id?: string };
    return String(bucket.tripId ?? raw.trip_id ?? '').trim();
}

/** Gasto tipo C (Viagens + pago do cofrinho) ligado à caixinha da viagem. */
export function bucketMatchesViagemOutflow(m: Movement, bucket: CofrinhoBucket): boolean {
    const tripId = movementTripId(m);
    const linkedTripId = bucketTripId(bucket);
    if (tripId && linkedTripId && tripId === linkedTripId) return true;

    const sub = String(m.subcategory ?? '').trim();
    if (!sub) return false;
    const name = String(bucket.name ?? '').trim();
    if (!name) return false;
    return name === sub || name.toLowerCase() === sub.toLowerCase();
}

export function resolveViagemBucketForTrip(
    tripId: string,
    tripTitle: string | undefined,
    buckets: CofrinhoBucket[]
): CofrinhoBucket | null {
    const id = String(tripId ?? '').trim();
    if (id) {
        const byTrip = buckets.find((b) => bucketTripId(b) === id);
        if (byTrip) return byTrip;
    }
    const title = String(tripTitle ?? '').trim();
    if (title) {
        const exact = buckets.find((b) => String(b.name ?? '').trim() === title);
        if (exact) return exact;
        const lower = title.toLowerCase();
        const ci = buckets.find((b) => String(b.name ?? '').trim().toLowerCase() === lower);
        if (ci) return ci;
    }
    return null;
}

export function resolveCofrinhoBucketForOutflow(m: Movement, buckets: CofrinhoBucket[]): CofrinhoBucket | null {
    const cat = String(m.category ?? '').trim();
    if (cat !== VIAGENS_EXPENSE_CATEGORY || !movementPaidFromTripCofrinho(m) || m.isPaid === false) {
        return null;
    }
    const tripId = movementTripId(m);
    const byTrip = resolveViagemBucketForTrip(tripId, m.subcategory, buckets);
    if (byTrip) return byTrip;
    return buckets.find((b) => bucketMatchesViagemOutflow(m, b)) ?? null;
}

export function resolveCofrinhoBucketForMovement(m: Movement, buckets: CofrinhoBucket[]): CofrinhoBucket | null {
    const cat = String(m.category ?? '').trim();
    if (cat !== EXPENSE_COFRINHO_CATEGORY) return null;
    const sub = String(m.subcategory ?? '').trim();
    if (isCofrinhoPoolSubcategoryName(sub)) return null;

    const tripId = movementTripId(m);
    if (tripId) {
        const byTrip = buckets.find((b) => bucketTripId(b) === tripId);
        if (byTrip) return byTrip;
    }

    if (!sub) return null;
    const subLower = sub.toLowerCase();
    return (
        buckets.find((b) => String(b.name ?? '').trim() === sub) ??
        buckets.find((b) => String(b.name ?? '').trim().toLowerCase() === subLower) ??
        null
    );
}

export function cofrinhoBucketDeltaForMovement(m: Movement, bucket: CofrinhoBucket): number {
    const amt = Math.max(0, Number(m.amount) || 0);
    const cat = String(m.category ?? '').trim();
    if (cat === EXPENSE_COFRINHO_CATEGORY) {
        const resolved = resolveCofrinhoBucketForMovement(m, [bucket]);
        if (!resolved || resolved.id !== bucket.id || m.isPaid === false) return 0;
        return amt;
    }

    if (cat === VIAGENS_EXPENSE_CATEGORY && movementPaidFromTripCofrinho(m)) {
        if (m.isPaid === false) return 0;
        if (bucketMatchesViagemOutflow(m, bucket)) return -amt;
    }

    return 0;
}

export { COFRINHO_POOL_SUBCATEGORY };