import type { DashboardFacets } from '../../../lib/types/finance';

export const REPORTS_DASHBOARD_FLOW_FACETS_KEY = 'reports.dashboard.flowFacetKeys';
const LEGACY_EXPENSE_KEY = 'reports.dashboard.expenseFacetKeys';

const EXPENSE_FACETS = new Set(['fixed', 'recurring', 'credit', 'pix', 'paid', 'unpaid']);
const GAIN_FACETS = new Set(['paid', 'unpaid']);

export const DEFAULT_DASHBOARD_FACETS: DashboardFacets = {
    gains: new Set(['paid', 'unpaid']),
    expenses: new Set(['paid', 'unpaid'])
};

function filterExpenseKeys(arr: unknown): DashboardFacets['expenses'] {
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.filter((k): k is string => typeof k === 'string' && EXPENSE_FACETS.has(k)));
}

function filterGainKeys(arr: unknown): DashboardFacets['gains'] {
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.filter((k): k is string => typeof k === 'string' && GAIN_FACETS.has(k)));
}

export function loadDashboardFacetsFromStorage(): DashboardFacets {
    try {
        const rawNew = localStorage.getItem(REPORTS_DASHBOARD_FLOW_FACETS_KEY);
        if (rawNew) {
            const parsed = JSON.parse(rawNew) as { expenses?: unknown; gains?: unknown };
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                const expenses = filterExpenseKeys(parsed.expenses);
                const gains = filterGainKeys(parsed.gains);
                if (expenses.size > 0 || gains.size > 0) {
                    return { expenses, gains };
                }
            }
        }
        const rawLegacy = localStorage.getItem(LEGACY_EXPENSE_KEY);
        if (rawLegacy) {
            const parsed = JSON.parse(rawLegacy);
            if (Array.isArray(parsed)) {
                const keys = filterGainKeys(parsed);
                const shared = new Set([...keys, ...filterExpenseKeys(parsed)]);
                persistDashboardFacets({ expenses: shared, gains: keys });
                return { expenses: new Set(shared), gains: keys };
            }
        }
    } catch {
        /* ignore */
    }
    return {
        gains: new Set(DEFAULT_DASHBOARD_FACETS.gains),
        expenses: new Set(DEFAULT_DASHBOARD_FACETS.expenses)
    };
}

export function persistDashboardFacets(facets: DashboardFacets) {
    const expenses = [...facets.expenses].sort();
    const gains = [...facets.gains].sort();
    try {
        localStorage.setItem(REPORTS_DASHBOARD_FLOW_FACETS_KEY, JSON.stringify({ expenses, gains }));
    } catch {
        /* ignore */
    }
}