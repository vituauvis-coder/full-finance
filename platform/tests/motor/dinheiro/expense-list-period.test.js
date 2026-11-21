import test from 'node:test';
import assert from 'node:assert/strict';
import {
    expenseMatchesListPeriod,
    filterExpenseRowsForListPeriod,
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

test('regressão Saídas: dateFrom/dateTo sincronizados do drawer ainda usam vencimento (não data da compra)', () => {
    const card = { id: 'c1', type: 'cartao_credito', closeDay: 1, dueDay: 5 };
    const expense = {
        id: 'e1',
        amount: 1200,
        installmentCount: 3,
        date: '2026-11-19',
        accountId: 'c1'
    };
    const dezStart = new Date(2026, 11, 1, 0, 0, 0, 0);
    const dezEnd = new Date(2026, 11, 31, 23, 59, 59, 999);

    const matched = filterExpenseRowsForListPeriod([expense], [card], dezStart, dezEnd, {
        dateFrom: '2026-12-01',
        dateTo: '2026-12-31'
    });
    assert.equal(matched.length, 1);
    assert.equal(matched[0].id, 'e1');
});
test('Saídas: referenceOnly (pré-âncora) ainda aparece no mês da competência — alinhado ao legacy', () => {
    const bank = { id: 'b1', type: 'conta_corrente' };
    const expense = {
        id: 'e-ref',
        amount: 200,
        date: '2026-01-15',
        accountId: 'b1',
        referenceOnly: true
    };
    const janStart = new Date(2026, 0, 1);
    const janEnd = new Date(2026, 0, 31, 23, 59, 59, 999);
    const matched = filterExpenseRowsForListPeriod([expense], [bank], janStart, janEnd, {});
    assert.equal(matched.length, 1);
    assert.equal(matched[0].id, 'e-ref');
});

test('Saídas: cartão referenceOnly (compra pré-âncora) entra no mês do vencimento da parcela', () => {
    const card = { id: 'c1', type: 'cartao_credito', closeDay: 4, dueDay: 10 };
    const expense = {
        id: 'e-watch',
        amount: 1312,
        installmentCount: 12,
        date: '2026-01-05',
        accountId: 'c1',
        referenceOnly: true
    };
    // compra 05/01, fecha dia 4 → 1ª fatura vence 10/02
    const fevStart = new Date(2026, 1, 1);
    const fevEnd = new Date(2026, 1, 28, 23, 59, 59, 999);
    const junStart = new Date(2026, 5, 1);
    const junEnd = new Date(2026, 5, 30, 23, 59, 59, 999);

    assert.equal(filterExpenseRowsForListPeriod([expense], [card], fevStart, fevEnd, {}).length, 1);
    assert.equal(filterExpenseRowsForListPeriod([expense], [card], junStart, junEnd, {}).length, 1);
});
