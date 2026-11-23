import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeTripFinanceView } from '../../../../motor/viagens/trip-finance-household.js';

test('deduplica tripExpenseId sem financeExpenseId no payload (mantém o espelho mais antigo)', () => {
    const view = mergeTripFinanceView({
        payloadExpenses: [{ id: 'te1', amount: 100, description: 'Taxa' }],
        householdExpenses: [
            {
                id: 'e-old',
                tripExpenseId: 'te1',
                amount: 100,
                description: 'Taxa',
                userId: 'u1',
                authorName: 'Millena',
                createdAt: '2026-11-18T10:00:00.000Z'
            },
            {
                id: 'e-new',
                tripExpenseId: 'te1',
                amount: 100,
                description: 'Taxa',
                userId: 'u2',
                authorName: 'Victor',
                createdAt: '2026-11-18T12:00:00.000Z'
            }
        ]
    });
    assert.equal(view.lines.filter((l) => l.tripExpenseId === 'te1').length, 1);
    assert.equal(view.lines.find((l) => l.tripExpenseId === 'te1').author.name, 'Millena');
});

test('deduplica mesmo tripExpenseId de dois membros (prefere financeExpenseId do payload)', () => {
    const view = mergeTripFinanceView({
        payloadExpenses: [
            { id: 'te1', amount: 2070, description: 'Taxa', financeExpenseId: 'e-millena' }
        ],
        householdExpenses: [
            {
                id: 'e-millena',
                tripExpenseId: 'te1',
                amount: 2070,
                description: 'Taxa',
                category: 'Viagens',
                paidFromCofrinho: true,
                userId: 'u1',
                authorName: 'Millena Santos'
            },
            {
                id: 'e-victor',
                tripExpenseId: 'te1',
                amount: 2070,
                description: 'Taxa',
                category: 'Viagens',
                paidFromCofrinho: true,
                userId: 'u2',
                authorName: 'Victor Alves'
            }
        ]
    });
    const gastos = view.lines.filter((l) => l.tripExpenseId === 'te1');
    assert.equal(gastos.length, 1);
    assert.equal(gastos[0].author.name, 'Millena Santos');
    assert.equal(gastos[0].ledgerKind, 'gasto_cofrinho');
});

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
