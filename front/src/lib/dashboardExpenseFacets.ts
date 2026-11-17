import {
    expenseMatchesDashboardFacet as matchExpense,
    gainMatchesDashboardFacet as matchGain
} from '@motor/dinheiro/dashboard-facets.js';
import type { Account, DashboardFacets, Movement } from './types/finance';

export function expenseMatchesDashboardFacet(
    expense: Movement,
    account: Account | undefined,
    facets: DashboardFacets['expenses']
) {
    return matchExpense(expense, account, facets);
}

export function gainMatchesDashboardFacet(gain: Movement, facets: DashboardFacets['gains']) {
    return matchGain(gain, facets);
}