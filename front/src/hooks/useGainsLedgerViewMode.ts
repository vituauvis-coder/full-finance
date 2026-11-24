import { useCallback, useState } from 'react';

export type GainsLedgerViewMode = 'simple' | 'split';

const STORAGE_KEY = 'gains-ledger-view-mode';

function readStoredMode(): GainsLedgerViewMode {
    try {
        const v = localStorage.getItem(STORAGE_KEY);
        if (v === 'split' || v === 'simple') return v;
    } catch {
        /* ignore */
    }
    return 'simple';
}

export function useGainsLedgerViewMode() {
    const [viewMode, setViewModeState] = useState<GainsLedgerViewMode>(() => readStoredMode());

    const setViewMode = useCallback((mode: GainsLedgerViewMode) => {
        setViewModeState(mode);
        try {
            localStorage.setItem(STORAGE_KEY, mode);
        } catch {
            /* ignore */
        }
    }, []);

    return { viewMode, setViewMode };
}