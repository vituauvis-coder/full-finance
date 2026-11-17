import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSyntheticExpectedSplitGainsRows } from '../../../../motor/dinheiro/expected-split-gain-rows.js';

test('buildSyntheticExpectedSplitGainsRows gera expectativa INSTALLMENT no mês alvo', () => {
    const now = new Date(2026, 4, 15);
    const expenses = [
        {
            id: 'exp1',
            accountId: 'acc-debit',
            amount: 100,
            description: 'Jantar',
            date: '2026-05-10T12:00:00.000Z',
            installmentCount: 1
        }
    ];
    const accounts = [{ id: 'acc-debit', type: 'CHECKING' }];
    const outgoing = [
        {
            id: 'split1',
            status: 'ACCEPTED',
            splitScope: 'INSTALLMENT',
            sourceExpenseId: 'exp1',
            targetPeriodKey: '2026-05',
            requesterCreditAccountId: 'acc-pix',
            amount: 40
        }
    ];

    const rows = buildSyntheticExpectedSplitGainsRows(
        'month-4',
        now,
        expenses,
        accounts,
        outgoing,
        [],
        2026
    );

    assert.equal(rows.length, 1);
    assert.equal(rows[0].amount, 40);
    assert.equal(rows[0].accountId, 'acc-pix');
    assert.equal(rows[0].__syntheticExpectedSplit, true);
    assert.equal(rows[0].relatedExpenseId, 'exp1');
});

test('buildSyntheticExpectedSplitGainsRows ignora split sem conta de crédito', () => {
    const rows = buildSyntheticExpectedSplitGainsRows(
        'month-5',
        new Date(2026, 4, 1),
        [{ id: 'e', accountId: 'a', date: '2026-05-01T12:00:00.000Z' }],
        [{ id: 'a', type: 'CHECKING' }],
        [
            {
                id: 's',
                status: 'ACCEPTED',
                splitScope: 'INSTALLMENT',
                sourceExpenseId: 'e',
                targetPeriodKey: '2026-05',
                amount: 10
            }
        ],
        [],
        2026
    );
    assert.equal(rows.length, 0);
});