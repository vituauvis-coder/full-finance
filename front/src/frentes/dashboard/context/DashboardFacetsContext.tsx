import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { DashboardFacets } from '../../../lib/types/finance';
import { scheduleUiChipsPersistToServer } from '../../../app/persistUiChips';
import { UI_CHIPS_HYDRATED_EVENT } from '../../../lib/uiChipPreferences';
import { loadDashboardFacetsFromStorage, persistDashboardFacets } from '../domain/dashboardFacetStorage';

type Ctx = {
    facets: DashboardFacets;
    toggleFacet: (flow: 'gains' | 'expenses', facet: string) => void;
    expenseCategories: Set<string>;
    toggleExpenseCategory: (name: string) => void;
    clearExpenseCategories: () => void;
    drawerOpen: boolean;
    setDrawerOpen: (v: boolean) => void;
};

const DashboardFacetsContext = createContext<Ctx | null>(null);

export function DashboardFacetsProvider({ children }: { children: ReactNode }) {
    const [facets, setFacets] = useState<DashboardFacets>(() => loadDashboardFacetsFromStorage());
    const [expenseCategories, setExpenseCategories] = useState<Set<string>>(() => new Set());
    const [drawerOpen, setDrawerOpen] = useState(false);

    useEffect(() => {
        const onHydrated = () => setFacets(loadDashboardFacetsFromStorage());
        window.addEventListener(UI_CHIPS_HYDRATED_EVENT, onHydrated);
        return () => window.removeEventListener(UI_CHIPS_HYDRATED_EVENT, onHydrated);
    }, []);

    const toggleFacet = useCallback((flow: 'gains' | 'expenses', facet: string) => {
        setFacets((prev) => {
            const set = new Set(prev[flow]);
            if (set.has(facet as never)) set.delete(facet as never);
            else set.add(facet as never);
            const next = { ...prev, [flow]: set };
            persistDashboardFacets(next);
            scheduleUiChipsPersistToServer();
            return next;
        });
    }, []);

    const toggleExpenseCategory = useCallback((name: string) => {
        setExpenseCategories((prev) => {
            const next = new Set(prev);
            if (next.has(name)) next.delete(name);
            else next.add(name);
            return next;
        });
    }, []);

    const clearExpenseCategories = useCallback(() => {
        setExpenseCategories(new Set());
    }, []);

    const value = useMemo(
        () => ({
            facets,
            toggleFacet,
            expenseCategories,
            toggleExpenseCategory,
            clearExpenseCategories,
            drawerOpen,
            setDrawerOpen
        }),
        [facets, toggleFacet, expenseCategories, toggleExpenseCategory, clearExpenseCategories, drawerOpen]
    );

    return <DashboardFacetsContext.Provider value={value}>{children}</DashboardFacetsContext.Provider>;
}

export function useDashboardFacets() {
    return useContext(DashboardFacetsContext);
}