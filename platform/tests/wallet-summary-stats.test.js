import assert from 'node:assert/strict';
import test from 'node:test';
import {
    creditCardInstallmentsDueInCalendarMonth,
    totalCreditInvoicesForMonth
} from '../../motor/dinheiro/wallet-invoice-month.js';

test('sem despesas, fatura do mês é zero', () => {
    const card = { id: 'c1', type: 'cartao_credito', dueDay: 10, closeDay: 5 };
    const sum = creditCardInstallmentsDueInCalendarMonth(card, [], 2026, 10, null, [], []);
    assert.equal(sum, 0);
    assert.equal(totalCreditInvoicesForMonth([card], [], 2026, 10), 0);
});