import assert from 'node:assert/strict';
import test from 'node:test';
import {
    getNetExpenseTotalAmount,
    normalizeSplitScope,
    sumAcceptedSettledFullSplitForExpense
} from '../../../../motor/dinheiro/split-net.js';

test('normalizeSplitScope', () => {
    assert.equal(normalizeSplitScope('installment'), 'INSTALLMENT');
    assert.equal(normalizeSplitScope('FULL_EXPENSE'), 'FULL_EXPENSE');
    assert.equal(normalizeSplitScope(null), 'FULL_EXPENSE');
});

test('getNetExpenseTotalAmount desconta split FULL aceito', () => {
    const expense = { id: 'e1', amount: 200 };
    const splits = [
        { status: 'ACCEPTED', splitScope: 'FULL_EXPENSE', sourceExpenseId: 'e1', amount: 50 }
    ];
    assert.equal(getNetExpenseTotalAmount(expense, splits), 150);
    assert.equal(sumAcceptedSettledFullSplitForExpense('e1', splits), 50);
});