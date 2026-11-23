import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
    UI_CHIPS_HYDRATED_EVENT,
    loadExpensesListStatusChips,
    loadGainsListStatusChips,
    persistExpensesListStatusChips,
    persistGainsListStatusChips,
    type ListStatusChips
} from '../../../lib/uiChipPreferences';
import { scheduleUiChipsPersistToServer } from '../../../app/persistUiChips';

export type DrawerFilters = {
    category: string;
    accountId: string;
    amountMin: string;
    amountMax: string;
    dateFrom: string;
    dateTo: string;
};

const EMPTY: DrawerFilters = {
    category: '',
    accountId: '',
    amountMin: '',
    amountMax: '',
    dateFrom: '',
    dateTo: ''
};

export type MovementHeaderAddAction = {
    id: string;
    onClick: () => void;
};

export type MovementHeaderIconAction = {
    id: string;
    icon: string;
    title: string;
    badge?: number;
    onClick: () => void;
};

type Ctx = {
    drawerOpen: boolean;
    setDrawerOpen: (v: boolean) => void;
    searchQ: string;
    setSearchQ: (v: string) => void;
    filters: DrawerFilters;
    setFilter: <K extends keyof DrawerFilters>(key: K, value: DrawerFilters[K]) => void;
    clearDrawerFilters: () => void;
    gainsStatus: ListStatusChips;
    expensesStatus: ListStatusChips;
    setGainsStatusPaid: (v: boolean) => void;
    setGainsStatusUnpaid: (v: boolean) => void;
    setExpensesStatusPaid: (v: boolean) => void;
    setExpensesStatusUnpaid: (v: boolean) => void;
    dateManual: boolean;
    setDateManual: (v: boolean) => void;
    clearDateManual: () => void;
    headerAddAction: MovementHeaderAddAction | null;
    setHeaderAddAction: (action: MovementHeaderAddAction | null) => void;
    headerIconAction: MovementHeaderIconAction | null;
    setHeaderIconAction: (action: MovementHeaderIconAction | null) => void;
};

const MovementListFiltersContext = createContext<Ctx | null>(null);

function persistGainsStatus(next: ListStatusChips) {
    persistGainsListStatusChips(next);
    scheduleUiChipsPersistToServer();
}

function persistExpensesStatus(next: ListStatusChips) {
    persistExpensesListStatusChips(next);
    scheduleUiChipsPersistToServer();
}

export function MovementListFiltersProvider({ children }: { children: ReactNode }) {
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [searchQ, setSearchQ] = useState('');
    const [filters, setFilters] = useState<DrawerFilters>({ ...EMPTY });
    const [gainsStatus, setGainsStatus] = useState<ListStatusChips>(() => loadGainsListStatusChips());
    const [expensesStatus, setExpensesStatus] = useState<ListStatusChips>(() => loadExpensesListStatusChips());
    const [dateManual, setDateManual] = useState(false);
    const [headerAddAction, setHeaderAddAction] = useState<MovementHeaderAddAction | null>(null);
    const [headerIconAction, setHeaderIconAction] = useState<MovementHeaderIconAction | null>(null);

    useEffect(() => {
        const onHydrated = () => {
            setGainsStatus(loadGainsListStatusChips());
            setExpensesStatus(loadExpensesListStatusChips());
        };
        window.addEventListener(UI_CHIPS_HYDRATED_EVENT, onHydrated);
        return () => window.removeEventListener(UI_CHIPS_HYDRATED_EVENT, onHydrated);
    }, []);

    const clearDateManual = useCallback(() => setDateManual(false), []);

    const setFilter = useCallback(<K extends keyof DrawerFilters>(key: K, value: DrawerFilters[K]) => {
        setFilters((prev) => ({ ...prev, [key]: value }));
    }, []);

    const clearDrawerFilters = useCallback(() => {
        setSearchQ('');
        setFilters({ ...EMPTY });
    }, []);

    const setGainsStatusPaid = useCallback((v: boolean) => {
        setGainsStatus((prev) => {
            const next = { ...prev, paid: v };
            persistGainsStatus(next);
            return next;
        });
    }, []);

    const setGainsStatusUnpaid = useCallback((v: boolean) => {
        setGainsStatus((prev) => {
            const next = { ...prev, unpaid: v };
            persistGainsStatus(next);
            return next;
        });
    }, []);

    const setExpensesStatusPaid = useCallback((v: boolean) => {
        setExpensesStatus((prev) => {
            const next = { ...prev, paid: v };
            persistExpensesStatus(next);
            return next;
        });
    }, []);

    const setExpensesStatusUnpaid = useCallback((v: boolean) => {
        setExpensesStatus((prev) => {
            const next = { ...prev, unpaid: v };
            persistExpensesStatus(next);
            return next;
        });
    }, []);

    const value = useMemo(
        () => ({
            drawerOpen,
            setDrawerOpen,
            searchQ,
            setSearchQ,
            filters,
            setFilter,
            clearDrawerFilters,
            gainsStatus,
            expensesStatus,
            setGainsStatusPaid,
            setGainsStatusUnpaid,
            setExpensesStatusPaid,
            setExpensesStatusUnpaid,
            dateManual,
            setDateManual,
            clearDateManual,
            headerAddAction,
            setHeaderAddAction,
            headerIconAction,
            setHeaderIconAction
        }),
        [
            drawerOpen,
            searchQ,
            filters,
            setFilter,
            clearDrawerFilters,
            gainsStatus,
            expensesStatus,
            setGainsStatusPaid,
            setGainsStatusUnpaid,
            setExpensesStatusPaid,
            setExpensesStatusUnpaid,
            dateManual,
            clearDateManual,
            headerAddAction,
            headerIconAction
        ]
    );

    return <MovementListFiltersContext.Provider value={value}>{children}</MovementListFiltersContext.Provider>;
}

export function useMovementListFilters() {
    return useContext(MovementListFiltersContext);
}