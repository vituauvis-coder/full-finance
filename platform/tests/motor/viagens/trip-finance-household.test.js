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
                category: 'Cofrinhos',
                isCofrinho: true,
                userId: 'u2',
                authorName: 'Victor',
                date: '2026-05-01'
            }
        ]
    });
    assert.equal(view.lines.length, 2);
    assert.equal(view.lines.find((l) => l.tripExpenseId === 'te1').author.name, 'Millena');
    const aporte = view.lines.find((l) => l.author?.name === 'Victor');
    assert.ok(aporte && aporte.amount === 50);
    assert.equal(aporte.ledgerKind, 'aporte');
    assert.equal(view.totals.aportes, 50);
});
