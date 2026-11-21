import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeTripFinanceView } from '../../../../motor/viagens/trip-finance-household.js';

test('não duplica tripExpenseId e preserva autor do Dinheiro', () => {
    const view = mergeTripFinanceView({
        payloadExpenses: [{ id: 'te1', amount: 10, description: 'Hotel' }],
        householdExpenses: [
            {
                id: 'e1',
                tripExpenseId: 'te1',
                amount: 10,
                description: 'Hotel',
                userId: 'u1',
                authorName: 'Millena'
            },
            {
                id: 'e2',
                tripExpenseId: null,
                amount: 50,
                description: 'Aporte',
                userId: 'u2',
                authorName: 'Victor'
            }
        ]
    });
    assert.equal(view.lines.length, 2);
    assert.equal(view.lines.find((l) => l.tripExpenseId === 'te1').author.name, 'Millena');
    assert.ok(view.lines.some((l) => l.author?.name === 'Victor' && l.amount === 50));
});
