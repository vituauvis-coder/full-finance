import { useCallback, useState } from 'react';

export type ExpensesLedgerViewMode = 'simple' | 'split';

const STORAGE_KEY = 'expenses-ledger-view-mode';

function readStoredMode(): ExpensesLedgerViewMode {
    try {
        const v = localStorage.getItem(STORAGE_KEY);
        if (v === 'split' || v === 'simple') return v;
    } catch {
        /* ignore */
    }
    return 'simple';
}

export function useExpensesLedgerViewMode() {
    const [viewMode, setViewModeState] = useState<ExpensesLedgerViewMode>(readStoredMode);

    const setViewMode = useCallback((mode: ExpensesLedgerViewMode) => {
        setViewModeState(mode);
        try {
            localStorage.setItem(STORAGE_KEY, mode);
        } catch {
            /* ignore */
        }
    }, []);

    return { viewMode, setViewMode };
}