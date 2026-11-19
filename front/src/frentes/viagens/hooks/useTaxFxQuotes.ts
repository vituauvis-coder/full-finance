import { useEffect, useState } from 'react';
import { DEFAULT_TAX_FX } from '@motor/viagens/tax-fx.js';
import { fetchTaxFxQuotes, type TaxFxQuotes } from '../api/trips';

let shared: TaxFxQuotes | null = null;
let inflight: Promise<TaxFxQuotes> | null = null;

function loadQuotes(): Promise<TaxFxQuotes> {
    if (shared && !shared.stale) return Promise.resolve(shared);
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

export function useTaxFxQuotes() {
    const [quotes, setQuotes] = useState<TaxFxQuotes | null>(shared);

    useEffect(() => {
        let alive = true;
        void loadQuotes().then((q) => {
            if (alive) setQuotes(q);
        });
        return () => {
            alive = false;
        };
    }, []);

    return quotes;
}