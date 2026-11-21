/** Cotações comerciais BRL para conversão de taxas de embarque. */

import { DEFAULT_TAX_FX } from './tax-fx.js';

const AWESOME_PAIRS = [
    'EUR-BRL',
    'USD-BRL',
    'GBP-BRL',
    'ARS-BRL',
    'CLP-BRL',
    'MXN-BRL',
    'JPY-BRL',
    'CHF-BRL',
    'CAD-BRL',
    'AUD-BRL',
    'TRY-BRL',
    'CNY-BRL',
    'HKD-BRL',
    'KRW-BRL'
].join(',');
const TTL_MS = 30 * 60 * 1000;

let cache = null;

function midBidAsk(row) {
    const bid = Number(row?.bid);
    const ask = Number(row?.ask);
    if (bid > 0 && ask > 0) return (bid + ask) / 2;
    if (bid > 0) return bid;
    if (ask > 0) return ask;
    return 0;
}

/** @param {Record<string, { bid?: string, ask?: string, create_date?: string }>} json */
export function parseAwesomeApiQuotes(json) {
    const rates = { BRL: 1 };
  let asOf = null;
    for (const key of Object.keys(json ?? {})) {
        if (!key.endsWith('BRL') || key.length <= 3) continue;
        const code = key.slice(0, -3);
        const row = json[key];
        const mid = midBidAsk(row);
        if (mid > 0) rates[code] = Number(mid.toFixed(6));
        if (!asOf && row?.create_date) asOf = row.create_date;
    }
    asOf = asOf ?? json.EURBRL?.create_date ?? json.USDBRL?.create_date ?? null;
    return { rates, asOf, source: 'awesomeapi' };
}

function withFallback(parsed) {
    const rates = { ...DEFAULT_TAX_FX, ...(parsed?.rates ?? {}) };
    for (const k of Object.keys(rates)) {
        const n = Number(rates[k]);
        rates[k] = Number.isFinite(n) && n > 0 ? n : DEFAULT_TAX_FX[k] ?? 0;
    }
    return rates;
}

/**
 * @param {typeof fetch} [fetchImpl]
 * @returns {Promise<{ rates: Record<string, number>, asOf: string | null, source: string, stale?: boolean }>}
 */
export async function fetchTaxFxQuotes(fetchImpl = globalThis.fetch) {
    const now = Date.now();
    if (cache && now - cache.fetchedAt < TTL_MS) {
        return {
            rates: { ...cache.rates },
            asOf: cache.asOf,
            source: cache.source,
            stale: false
        };
    }

    if (!fetchImpl) {
        return {
            rates: { ...DEFAULT_TAX_FX },
            asOf: null,
            source: 'default',
            stale: true
        };
    }

    try {
        const res = await fetchImpl(
            `https://economia.awesomeapi.com.br/json/last/${AWESOME_PAIRS}`,
            { headers: { Accept: 'application/json' } }
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const parsed = parseAwesomeApiQuotes(json);
        const rates = withFallback(parsed);
        cache = {
            rates,
            asOf: parsed.asOf,
            source: parsed.source,
            fetchedAt: now
        };
        return { rates, asOf: parsed.asOf, source: parsed.source, stale: false };
    } catch {
        const rates = { ...DEFAULT_TAX_FX };
        return { rates, asOf: null, source: 'default', stale: true };
    }
}

export function clearTaxFxQuotesCache() {
    cache = null;
}