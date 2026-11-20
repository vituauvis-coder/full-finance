import test from 'node:test';
import assert from 'node:assert/strict';
import {
    expenseMatchesListPeriod,
    resolveCreditBillingDays
} from '../../../../motor/dinheiro/expense-list-period.js';

test('resolveCreditBillingDays: fechamento padrão 1 se só vencimento', () => {
    assert.deepEqual(resolveCreditBillingDays({ dueDay: 25 }), { closeDay: 1, dueDay: 25 });
});

test('cartão: compra em nov não entra na lista de nov se 1ª fatura é dez', () => {
    const card = { id: 'c1', type: 'cartao_credito', closeDay: 1, dueDay: 5 };
    const expense = {
        id: 'e1',
        amount: 1200,
        installmentCount: 3,
        date: '2026-11-19',
        accountId: 'c1'
    };
    const novStart = new Date(2026, 10, 1, 0, 0, 0, 0);
    const novEnd = new Date(2026, 10, 30, 23, 59, 59, 999);
    const dezStart = new Date(2026, 11, 1, 0, 0, 0, 0);
    const dezEnd = new Date(2026, 11, 31, 23, 59, 59, 999);

    assert.equal(expenseMatchesListPeriod(expense, card, novStart, novEnd), false);
    assert.equal(expenseMatchesListPeriod(expense, card, dezStart, dezEnd), true);
});

test('cartão: só dueDay cadastrado usa fechamento 1 (compra após corte → dez)', () => {
    const card = { id: 'c1', type: 'cartao_credito', dueDay: 25 };
    const expense = {
        id: 'e1',
        amount: 900,
        installmentCount: 3,
        date: '2026-11-19',
        accountId: 'c1'
    };
    const novEnd = new Date(2026, 10, 30, 23, 59, 59, 999);
    const novStart = new Date(2026, 10, 1);
    const dezStart = new Date(2026, 11, 1);
    const dezEnd = new Date(2026, 11, 31, 23, 59, 59, 999);

    assert.equal(expenseMatchesListPeriod(expense, card, novStart, novEnd), false);
    assert.equal(expenseMatchesListPeriod(expense, card, dezStart, dezEnd), true);
});