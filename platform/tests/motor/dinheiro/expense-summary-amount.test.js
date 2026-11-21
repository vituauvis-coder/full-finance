import assert from 'node:assert/strict';
import test from 'node:test';
import { getExpenseSummaryContributionAmount } from '../../../../motor/dinheiro/expense-summary-amount.js';

test('summary contribution desconta split FULL aceito (ex.: Plano Multi 329 → 229)', () => {
    const expense = { id: 'e-multi', amount: 329 };
    const splits = [
        {
            status: 'ACCEPTED',
            splitScope: 'FULL_EXPENSE',
            sourceExpenseId: 'e-multi',
            amount: 100
        }
    ];
    assert.equal(
        getExpenseSummaryContributionAmount(expense, null, splits, null, '2026-12'),
        229
    );
});

test('summary contribution sem splits usa valor bruto / parcela', () => {
    const expense = { id: 'e2', amount: 200, installmentCount: 1 };
    assert.equal(getExpenseSummaryContributionAmount(expense, null, [], null, '2026-12'), 200);
});
