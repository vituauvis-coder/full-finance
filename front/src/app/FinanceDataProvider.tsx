import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { apiFetch } from '../lib/http';
import { normalizeFinanceAccounts } from '../lib/normalizeAccounts';
import { PROFILE_UPDATED_EVENT } from '../lib/profileEvents';
import type { FinanceData } from '../lib/types/finance';
import { applyScreenAccentsFromProfile } from './screenAccents';

type Ctx = {
    loading: boolean;
    error: string | null;
    data: FinanceData | null;
    refresh: () => Promise<void>;
};

const FinanceDataContext = createContext<Ctx | null>(null);

const EMPTY: FinanceData = {
    userProfile: null,
    userAccounts: [],
    userExpenses: [],
    userGains: [],
    cofrinhoBuckets: [],
    cofrinhoApplications: [],
    cofrinhoBucketGoals: [],
    cofrinhoTripPayloadOutflows: [],
    userDebts: [],
    userDebtUpdates: [],
    expenseSplitRequests: { incoming: [], outgoing: [] },
    userNotifications: [],
    household: null,
    householdMembers: []
};

export function FinanceDataProvider({ children }: { children: ReactNode }) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<FinanceData | null>(null);

    const refresh = useCallback(async () => {
        try {
            setError(null);
            const raw = await apiFetch<FinanceData>('/api/data');
            setData({
                ...EMPTY,
                ...raw,
                userAccounts: normalizeFinanceAccounts(raw.userAccounts),
                userExpenses: raw.userExpenses ?? [],
                userGains: raw.userGains ?? [],
                expenseSplitRequests: raw.expenseSplitRequests ?? { incoming: [], outgoing: [] },
                cofrinhoTripPayloadOutflows: raw.cofrinhoTripPayloadOutflows ?? []
            });
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Erro ao carregar dados');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    useEffect(() => {
        const onFinanceChanged = () => {
            void refresh();
        };
        window.addEventListener('finance:data-changed', onFinanceChanged);
        return () => window.removeEventListener('finance:data-changed', onFinanceChanged);
    }, [refresh]);

    useEffect(() => {
        applyScreenAccentsFromProfile(data?.userProfile);
    }, [data?.userProfile]);

    useEffect(() => {
        const syncFromProfileEvent = (e: Event) => {
            const detail = (e as CustomEvent).detail;
            if (detail && typeof detail === 'object') {
                applyScreenAccentsFromProfile(detail);
                return;
            }
            applyScreenAccentsFromProfile(data?.userProfile);
        };
        const syncOnTheme = () => {
            applyScreenAccentsFromProfile(data?.userProfile);
        };
        window.addEventListener(PROFILE_UPDATED_EVENT, syncFromProfileEvent);
        window.addEventListener('meumundo-themechange', syncOnTheme);
        return () => {
            window.removeEventListener(PROFILE_UPDATED_EVENT, syncFromProfileEvent);
            window.removeEventListener('meumundo-themechange', syncOnTheme);
        };
    }, [data?.userProfile]);

    const value = useMemo(() => ({ loading, error, data, refresh }), [loading, error, data, refresh]);

    return <FinanceDataContext.Provider value={value}>{children}</FinanceDataContext.Provider>;
}

export function useFinanceData() {
    const ctx = useContext(FinanceDataContext);
    if (!ctx) throw new Error('useFinanceData outside FinanceDataProvider');
    return ctx;
}