import {
    buildFinancePreferencesWithUiChips,
    getUiChipsFromProfile,
    normalizeUiChips
} from '@motor/dinheiro/ui-chip-preferences.js';
import {
    REPORTS_DASHBOARD_FLOW_FACETS_KEY,
    loadDashboardFacetsFromStorage,
    persistDashboardFacets
} from '../frentes/dashboard/domain/dashboardFacetStorage';
import type { UserProfile } from './types/finance';
import type { DashboardFacets } from './types/finance';

export type ListStatusChips = { paid: boolean; unpaid: boolean };
export type UiChipsSnapshot = ReturnType<typeof normalizeUiChips>;

const GAINS_LIST_KEY = 'movementList.gains.statusChips';
const EXPENSES_LIST_KEY = 'movementList.expenses.statusChips';

export const UI_CHIPS_HYDRATED_EVENT = 'finance-ui-chips-hydrated';

function readJson<T>(key: string): T | null {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        return JSON.parse(raw) as T;
    } catch {
        return null;
    }
}

function writeJson(key: string, value: unknown) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch {
        /* ignore */
    }
}

export function loadGainsListStatusChips(): ListStatusChips {
    const parsed = readJson<ListStatusChips>(GAINS_LIST_KEY);
    return {
        paid: Boolean(parsed?.paid),
        unpaid: Boolean(parsed?.unpaid)
    };
}

export function loadExpensesListStatusChips(): ListStatusChips {
    const parsed = readJson<ListStatusChips>(EXPENSES_LIST_KEY);
    return {
        paid: Boolean(parsed?.paid),
        unpaid: Boolean(parsed?.unpaid)
    };
}

export function persistGainsListStatusChips(chips: ListStatusChips) {
    writeJson(GAINS_LIST_KEY, chips);
}

export function persistExpensesListStatusChips(chips: ListStatusChips) {
    writeJson(EXPENSES_LIST_KEY, chips);
}

export function snapshotUiChipsFromLocalStorage(): UiChipsSnapshot {
    const dashboard = loadDashboardFacetsFromStorage();
    return normalizeUiChips({
        dashboard: {
            gains: [...dashboard.gains],
            expenses: [...dashboard.expenses]
        },
        gainsList: loadGainsListStatusChips(),
        expensesList: loadExpensesListStatusChips()
    });
}

export function applyUiChipsToLocalStorage(chips: UiChipsSnapshot) {
    const normalized = normalizeUiChips(chips);
    persistDashboardFacets({
        gains: new Set(normalized.dashboard.gains),
        expenses: new Set(normalized.dashboard.expenses)
    } as DashboardFacets);
    persistGainsListStatusChips(normalized.gainsList);
    persistExpensesListStatusChips(normalized.expensesList);
}

export function dispatchUiChipsHydrated() {
    window.dispatchEvent(new CustomEvent(UI_CHIPS_HYDRATED_EVENT));
}

export function hydrateUiChipsFromUserProfile(profile: UserProfile | null | undefined) {
    const fromServer = getUiChipsFromProfile(profile ?? undefined);
    applyUiChipsToLocalStorage(fromServer);
    dispatchUiChipsHydrated();
}

export { buildFinancePreferencesWithUiChips, getUiChipsFromProfile, normalizeUiChips };
export { REPORTS_DASHBOARD_FLOW_FACETS_KEY };