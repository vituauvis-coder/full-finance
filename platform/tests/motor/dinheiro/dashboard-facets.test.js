import assert from 'node:assert/strict';
import test from 'node:test';
import {
    expenseMatchesDashboardFacet,
    gainMatchesDashboardFacet
} from '../../../../motor/dinheiro/dashboard-facets.js';

test('gainMatchesDashboardFacet — paid only', () => {
    const facets = new Set(['paid']);
    assert.equal(gainMatchesDashboardFacet({ isPaid: true }, facets), true);
    assert.equal(gainMatchesDashboardFacet({ isPaid: false }, facets), false);
});

test('expenseMatchesDashboardFacet — fixed', () => {
    const facets = new Set(['fixed', 'paid']);
    const expense = { isFixed: true, isPaid: true, amount: 10, date: '2026-01-15' };
    assert.equal(expenseMatchesDashboardFacet(expense, undefined, facets), true);
});