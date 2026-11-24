import assert from 'node:assert/strict';
import test from 'node:test';
import {
    expenseIdForSplitLookup,
    getExpenseListRowDisplayAmount
} from '../../../../motor/dinheiro/expense-list-display-amount.js';

test('expenseIdForSplitLookup remove sufixo de linha de parcela', () => {
    assert.equal(expenseIdForSplitLookup({ id: 'zara::inst-2026-12-07' }), 'zara');
    assert.equal(expenseIdForSplitLookup({ id: 'plain' }), 'plain');
});

test('parcela expandida aplica split FULL mesmo com id composto', () => {
    const splits = [
        {
            status: 'ACCEPTED',
            splitScope: 'FULL_EXPENSE',
            sourceExpenseId: 'zara',
            amount: 54
        }
    ];
    const row = {
        id: 'zara::inst-2026-12-07',
        amount: 162,
        installmentCount: 3,
        __instRow: true,
        __instParcelAmount: 54,
        __instPeriodKey: '2026-12-07',
        date: '2026-12-07'
    };
    assert.equal(
        getExpenseListRowDisplayAmount(row, { type: 'credit_card' }, splits, null),
        36
    );
});

test('800 em 2x com dois rateios de 300 (um id de parcela órfão)', () => {
    const splits = [
        {
            status: 'ACCEPTED',
            splitScope: 'FULL_EXPENSE',
            sourceExpenseId: 'pts',
            amount: 300
        },
        {
            status: 'ACCEPTED',
            splitScope: 'FULL_EXPENSE',
            sourceExpenseId: 'pts::inst-2026-11-15',
            amount: 300
        }
    ];
    const row = {
        id: 'pts::inst-2026-11-15',
        amount: 800,
        installmentCount: 2,
        __instRow: true,
        __instParcelAmount: 400,
        __instPeriodKey: '2026-11-15',
        date: '2026-11-15'
    };
    assert.equal(
        getExpenseListRowDisplayAmount(row, { type: 'credit_card' }, splits, null),
        100
    );
});