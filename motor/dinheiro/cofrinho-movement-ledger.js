import { paidFromCofrinho as tripExpensePaidFromCofrinho } from '../viagens/trip-expense-payment.js';

export const COFRINHO_CATEGORY = 'Cofrinhos';
export const VIAGENS_CATEGORY = 'Viagens';
export const COFRINHO_POOL_SUBCATEGORY = 'Pool';

export const COFRINHO_BUCKET_KIND_RESERVE = 'reserve';
export const COFRINHO_BUCKET_KIND_VIAGEM = 'viagem';
export const COFRINHO_BUCKET_KIND_POOL = 'pool';

export function movementPaidFromTripCofrinho(movement) {
    if (tripExpensePaidFromCofrinho(movement)) return true;
    const v = movement?.paidFromCofrinho ?? movement?.paid_from_cofrinho;
    return v === true || v === 'true' || v === 1 || v === '1';
}

export function isCofrinhoPoolSubcategoryName(subcategory) {
    const s = String(subcategory ?? '').trim();
    return !s || s.toLowerCase() === COFRINHO_POOL_SUBCATEGORY.toLowerCase();
}

/**
 * Não debita saldo de conta — dinheiro já está na caixinha (tipo C).
 */
export function movementSkipsAccountCashOut(movement) {
    return movementPaidFromTripCofrinho(movement);
}

function movementTripId(movement) {
    return String(movement?.tripId ?? movement?.trip_id ?? '').trim();
}

function bucketTripId(bucket) {
    return String(bucket?.tripId ?? bucket?.trip_id ?? '').trim();
}

export function bucketMatchesViagemOutflow(movement, bucket) {
    const tripId = movementTripId(movement);
    const linkedTripId = bucketTripId(bucket);
    if (tripId && linkedTripId && tripId === linkedTripId) return true;

    const sub = String(movement?.subcategory ?? '').trim();
    if (!sub) return false;
    const name = String(bucket?.name ?? '').trim();
    if (!name) return false;
    return name === sub || name.toLowerCase() === sub.toLowerCase();
}

export function resolveCofrinhoBucketForOutflow(movement, buckets = []) {
    const cat = String(movement?.category ?? '').trim();
    if (cat !== VIAGENS_CATEGORY || !movementPaidFromTripCofrinho(movement) || movement?.isPaid === false) {
        return null;
    }
    const tripId = movementTripId(movement);
    if (tripId) {
        const byTrip = (buckets ?? []).find((b) => bucketTripId(b) === tripId);
        if (byTrip) return byTrip;
    }
    return (buckets ?? []).find((b) => bucketMatchesViagemOutflow(movement, b)) ?? null;
}

/**
 * @param {object} movement
 * @param {object[]} buckets
 */
export function resolveCofrinhoBucketForMovement(movement, buckets = []) {
    const cat = String(movement?.category ?? '').trim();
    if (cat !== COFRINHO_CATEGORY) return null;
    const sub = String(movement?.subcategory ?? '').trim();
    if (isCofrinhoPoolSubcategoryName(sub)) return null;

    const tripId = movementTripId(movement);
    if (tripId) {
        const byTrip = (buckets ?? []).find((b) => bucketTripId(b) === tripId);
        if (byTrip) return byTrip;
    }

    const name = sub;
    if (!name) return null;
    return (buckets ?? []).find((b) => String(b?.name ?? '').trim() === name) ?? null;
}

/**
 * Efeito líquido na caixinha (positivo = aporte, negativo = gasto do cofrinho).
 */
export function cofrinhoBucketDeltaForMovement(movement, bucket) {
    if (!bucket) return 0;
    const amt = Math.max(0, Number(movement?.amount) || 0);
    const cat = String(movement?.category ?? '').trim();
    if (cat === COFRINHO_CATEGORY) {
        const resolved = resolveCofrinhoBucketForMovement(movement, [bucket]);
        if (!resolved || resolved.id !== bucket.id) return 0;
        if (movement?.isPaid === false) return 0;
        return amt;
    }

    if (cat === VIAGENS_CATEGORY && movementPaidFromTripCofrinho(movement)) {
        if (movement?.isPaid === false) return 0;
        if (bucketMatchesViagemOutflow(movement, bucket)) return -amt;
    }

    return 0;
}