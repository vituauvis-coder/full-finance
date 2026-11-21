import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_TAX_FX } from '@motor/viagens/tax-fx.js';
import { fetchTaxFxQuotes, type TaxFxQuotes } from '../api/trips';

let shared: TaxFxQuotes | null = null;
let inflight: Promise<TaxFxQuotes> | null = null;

function loadQuotes(force = false): Promise<TaxFxQuotes> {
    if (!force && shared && !shared.stale) return Promise.resolve(shared);
    if (inflight) return inflight;
    inflight = fetchTaxFxQuotes()
        .then((q) => {
            shared = q;
            return q;
        })
        .catch(() => {
            const fallback: TaxFxQuotes = {
                rates: { ...DEFAULT_TAX_FX },
                asOf: null,
                source: 'default',
                stale: true
            };
            shared = fallback;
            return fallback;
        })
        .finally(() => {
            inflight = null;
        });
    return inflight;
}

/** Força nova busca na API (ignora cache em memória). */
export function refreshTaxFxQuotes(): Promise<TaxFxQuotes> {
    shared = null;
    return loadQuotes(true);
}

export function useTaxFxQuotes(options?: { enabled?: boolean; refreshKey?: number }) {
    const enabled = options?.enabled ?? true;
    const refreshKey = options?.refreshKey ?? 0;
    const [quotes, setQuotes] = useState<TaxFxQuotes | null>(shared);
    const [loading, setLoading] = useState(enabled && !shared);

    const reload = useCallback(() => {
        if (!enabled) return Promise.resolve(quotes);
        setLoading(true);
        return refreshTaxFxQuotes().then((q) => {
            setQuotes(q);
            setLoading(false);
            return q;
        });
    }, [enabled, quotes]);

    useEffect(() => {
        if (!enabled) return;
        let alive = true;
        setLoading(true);
        const run = refreshKey > 0 ? refreshTaxFxQuotes() : loadQuotes();
        void run.then((q) => {
            if (alive) {
                setQuotes(q);
                setLoading(false);
            }
        });
        return () => {
            alive = false;
        };
    }, [enabled, refreshKey]);

    return { quotes, loading, reload };
}