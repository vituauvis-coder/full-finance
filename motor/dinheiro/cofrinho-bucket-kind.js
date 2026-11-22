const USER_KINDS = new Set([
    'emergencia',
    'curto_prazo',
    'investimento',
    'longo_prazo',
    'objetivo',
    'reserve'
]);

export function normalizeUserCofrinhoKind(input, fallback = 'objetivo') {
    const k = String(input ?? fallback).trim();
    return USER_KINDS.has(k) ? k : fallback;
}

export function bucketKindForWrite(body, existing = null) {
    if (existing?.trip_id || existing?.tripId || String(existing?.kind ?? '') === 'viagem') {
        return 'viagem';
    }
    const tripId = String(body?.tripId ?? body?.trip_id ?? '').trim();
    if (tripId || body?.kind === 'viagem') {
        return 'viagem';
    }
    if (body?.kind === undefined && existing?.kind) return String(existing.kind);
    return normalizeUserCofrinhoKind(body?.kind, existing?.kind ?? 'objetivo');
}