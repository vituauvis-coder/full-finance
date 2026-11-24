import {
    COFRINHO_CATEGORY,
    cofrinhoBucketDeltaForMovement,
    resolveCofrinhoBucketForMovement
} from '../dinheiro/cofrinho-movement-ledger.js';

const POOL_SUB = 'pool';

function bucketTripId(bucket) {
    return String(bucket?.tripId ?? bucket?.trip_id ?? '').trim();
}

function appBucketId(app) {
    return String(app?.bucketId ?? app?.bucket_id ?? '').trim();
}

function appReferenceDate(app) {
    const raw = String(app?.referenceMonth ?? app?.reference_month ?? '').trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
    if (/^\d{4}-\d{2}$/.test(raw)) return `${raw}-15`;
    return null;
}

function movementDateIso(m) {
    const d = m?.date;
    if (d instanceof Date && !Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    const s = String(d ?? '').trim();
    const hit = s.match(/^(\d{4}-\d{2}-\d{2})/);
    return hit ? hit[1] : null;
}

function isPoolExpense(m) {
    const sub = String(m?.subcategory ?? '').trim().toLowerCase();
    return sub === POOL_SUB || !sub;
}

function allocatedExpenseIds(applications) {
    const ids = new Set();
    for (const app of applications ?? []) {
        const id = String(app?.allocatedExpenseId ?? app?.allocated_expense_id ?? '').trim();
        if (id) ids.add(id);
    }
    return ids;
}

/**
 * Aportes da caixinha-viagem que ainda não vieram na query por `trip_id` / subcategoria.
 *
 * @param {string} tripId
 * @param {object[]} buckets
 * @param {object[]} applications
 * @param {object[]} cofrinhoExpenses — saídas Cofrinhos visíveis na household
 * @param {Set<string>} existingExpenseIds
 */
export function supplementTripAportesFromCofrinhoLedger(
    tripId,
    buckets,
    applications,
    cofrinhoExpenses,
    existingExpenseIds,
    tripTitle = ''
) {
    const tid = String(tripId ?? '').trim();
    if (!tid) return [];

    const titleKey = String(tripTitle ?? '').trim().toLowerCase();
    const tripBuckets = (buckets ?? []).filter((b) => {
        if (bucketTripId(b) === tid) return true;
        if (!titleKey) return false;
        const name = String(b?.name ?? '').trim().toLowerCase();
        return !bucketTripId(b) && name === titleKey;
    });
    if (!tripBuckets.length) return [];

    const bucketIds = new Set(tripBuckets.map((b) => String(b.id)));
    const seen = new Set(existingExpenseIds ?? []);
    const allocIds = allocatedExpenseIds(applications);
    const out = [];

    for (const app of applications ?? []) {
        const bId = appBucketId(app);
        if (!bucketIds.has(bId)) continue;
        const amount = Math.max(0, Number(app.amount) || 0);
        if (amount <= 0) continue;

        const allocId = String(app?.allocatedExpenseId ?? app?.allocated_expense_id ?? '').trim();
        const lineId = allocId || `cofrinho-app-${app.id}`;
        if (seen.has(lineId)) continue;
        seen.add(lineId);

        out.push({
            id: lineId,
            tripExpenseId: null,
            amount,
            description: 'Aporte — distribuição no cofrinho',
            category: COFRINHO_CATEGORY,
            isCofrinho: true,
            paidFromCofrinho: false,
            date: appReferenceDate(app),
            userId: app.userId ?? app.user_id ?? '',
            authorName: app.authorName ?? null
        });
    }

    for (const m of cofrinhoExpenses ?? []) {
        const id = String(m?.id ?? '').trim();
        if (!id || seen.has(id)) continue;
        if (m?.isPaid === false) continue;
        if (allocIds.has(id)) continue;
        if (String(m?.category ?? '').trim() !== COFRINHO_CATEGORY) continue;
        if (isPoolExpense(m)) continue;

        const mUserId = String(m?.userId ?? m?.user_id ?? '').trim();
        const userTripBuckets = mUserId
            ? tripBuckets.filter((b) => String(b?.userId ?? b?.user_id ?? '').trim() === mUserId)
            : [];
        const resolved = resolveCofrinhoBucketForMovement(
            m,
            userTripBuckets.length ? userTripBuckets : tripBuckets
        );
        if (!resolved) continue;
        const delta = cofrinhoBucketDeltaForMovement(m, resolved);
        if (delta <= 0) continue;

        seen.add(id);
        out.push({
            id,
            tripExpenseId: null,
            amount: delta,
            description: m.description ?? 'Aporte no cofrinho',
            category: COFRINHO_CATEGORY,
            isCofrinho: true,
            paidFromCofrinho: false,
            date: movementDateIso(m),
            userId: m.userId ?? m.user_id ?? '',
            authorName: m.authorName ?? null
        });
    }

    return out;
}