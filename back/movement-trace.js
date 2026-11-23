/** @typedef {{ source: string, externalRef: string | null, receiptUrl: string | null }} MovementTraceFields */

export function movementSourceFromRequest(req) {
    return req.session?.authVia === 'agent' ? 'agent' : 'app';
}

function readExternalRef(body) {
    const raw = body?.externalRef ?? body?.external_ref;
    if (raw == null || raw === '') return null;
    const s = String(raw).trim();
    return s || null;
}

function readReceiptUrl(body) {
    const raw = body?.receiptUrl ?? body?.receipt_url;
    if (raw == null || raw === '') return null;
    const s = String(raw).trim();
    return s || null;
}

/** Campos de rastreio para INSERT de expenses/gains. */
export function movementTraceFromRequest(req, body) {
    const source = movementSourceFromRequest(req);
    return {
        source,
        externalRef: readExternalRef(body),
        receiptUrl: readReceiptUrl(body)
    };
}

export function isExternalRefUniqueViolation(err) {
    if (err?.code !== '23505') return false;
    const c = String(err.constraint || '');
    return c.includes('external_ref') || c.includes('user_external_ref');
}