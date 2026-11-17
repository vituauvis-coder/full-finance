/** Chips de filtro (dashboard, entradas, saídas) — persistidos em `finance_preferences.uiChips`. */

import { getFinancePreferences } from './finance-preferences.js';

export const DEFAULT_UI_CHIPS = {
    dashboard: { gains: [], expenses: [] },
    gainsList: { paid: false, unpaid: false },
    expensesList: { paid: false, unpaid: false }
};

const GAIN_FACETS = new Set(['paid', 'unpaid']);
const EXPENSE_FACETS = new Set(['fixed', 'recurring', 'credit', 'pix', 'paid', 'unpaid']);

function filterFacetList(arr, allowed) {
    if (!Array.isArray(arr)) return [];
    return arr.filter((k) => typeof k === 'string' && allowed.has(k));
}

function normalizeStatusChipPair(obj) {
    if (!obj || typeof obj !== 'object') {
        return { paid: false, unpaid: false };
    }
    return {
        paid: Boolean(obj.paid),
        unpaid: Boolean(obj.unpaid)
    };
}

/** @param {unknown} raw */
export function normalizeUiChips(raw) {
    if (!raw || typeof raw !== 'object') {
        return {
            dashboard: { gains: [...DEFAULT_UI_CHIPS.dashboard.gains], expenses: [...DEFAULT_UI_CHIPS.dashboard.expenses] },
            gainsList: { ...DEFAULT_UI_CHIPS.gainsList },
            expensesList: { ...DEFAULT_UI_CHIPS.expensesList }
        };
    }
    const r = /** @type {Record<string, unknown>} */ (raw);
    const dash = r.dashboard && typeof r.dashboard === 'object' ? r.dashboard : {};
    return {
        dashboard: {
            gains: filterFacetList(/** @type {unknown} */ (dash).gains, GAIN_FACETS),
            expenses: filterFacetList(/** @type {unknown} */ (dash).expenses, EXPENSE_FACETS)
        },
        gainsList: normalizeStatusChipPair(r.gainsList),
        expensesList: normalizeStatusChipPair(r.expensesList)
    };
}

/** @param {{ financePreferences?: unknown } | null | undefined} userProfile */
export function parseFinancePreferencesRaw(userProfile) {
    let raw = userProfile?.financePreferences;
    if (raw == null || raw === '') return {};
    if (typeof raw === 'string') {
        try {
            raw = JSON.parse(raw);
        } catch {
            return {};
        }
    }
    return typeof raw === 'object' && raw !== null ? raw : {};
}

/** @param {{ financePreferences?: unknown } | null | undefined} userProfile */
export function getUiChipsFromProfile(userProfile) {
    const raw = parseFinancePreferencesRaw(userProfile);
    return normalizeUiChips(raw.uiChips);
}

/**
 * Corpo para PATCH `/api/profile` sem apagar `manualCashOut` nem chaves desconhecidas.
 * @param {{ financePreferences?: unknown } | null | undefined} userProfile
 * @param {ReturnType<typeof normalizeUiChips>} uiChips
 */
export function buildFinancePreferencesWithUiChips(userProfile, uiChips) {
    const prefs = getFinancePreferences(userProfile);
    const raw = parseFinancePreferencesRaw(userProfile);
    return {
        ...raw,
        manualCashOut: { ...prefs.manualCashOut },
        uiChips: normalizeUiChips(uiChips)
    };
}