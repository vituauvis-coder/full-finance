import test from 'node:test';
import assert from 'node:assert/strict';
import {
    cardCommittedAmount,
    cardInstallmentAmount,
    installmentCount,
    paidViaPixAmount,
    paymentBreakdown,
    sumPaymentBreakdown,
    tripCashCommitted,
    sumCofrinhoSpent,
    cofrinhoSpentAmount
} from '../../../../motor/viagens/trip-expense-payment.js';

test('pix counts as paid, card counts as committed', () => {
    const pix = { amount: 100, paymentMethod: 'pix' };
    const card = { amount: 1200, paymentMethod: 'credit_card', installments: 3 };
    assert.equal(paidViaPixAmount(pix), 100);
    assert.equal(cardCommittedAmount(card), 1200);
    assert.equal(cardInstallmentAmount(card), 400);
});

test('sumPaymentBreakdown aggregates', () => {
    const rows = [
        { amount: 50, payment_method: 'pix' },
        { amount: 300, payment_method: 'credit_card', installment_count: 2 }
    ];
    const s = sumPaymentBreakdown(rows);
    assert.equal(s.committed, 350);
    assert.equal(s.pixPaid, 50);
    assert.equal(s.cardCommitted, 300);
    assert.equal(s.cardInstallmentMonthly, 150);
});

test('sumPaymentBreakdown splits card single vs installment total', () => {
    const rows = [
        { amount: 200, paymentMethod: 'credit_card', installments: 1 },
        { amount: 600, paymentMethod: 'credit_card', installments: 3 }
    ];
    const s = sumPaymentBreakdown(rows);
    assert.equal(s.cardCommitted, 800);
    assert.equal(s.cardSingle, 200);
    assert.equal(s.cardInstallmentTotal, 600);
});

test('paymentBreakdown filters by category', () => {
    const trip = {
        payload: {
            expenses: [
                { amount: 10, category: 'comida', paymentMethod: 'pix' },
                { amount: 90, category: 'extras', paymentMethod: 'credit_card', installments: 1 }
            ]
        }
    };
    const food = paymentBreakdown(trip, { category: 'comida' });
    assert.equal(food.pixPaid, 10);
    assert.equal(food.cardCommitted, 0);
});

test('cofrinho spent flags', () => {
    const row = { amount: 250, paymentMethod: 'pix', paidFromCofrinho: true };
    const other = { amount: 100, paymentMethod: 'pix' };
    assert.equal(cofrinhoSpentAmount(row), 250);
    assert.equal(cofrinhoSpentAmount(other), 0);
    assert.equal(sumCofrinhoSpent([row, other]), 250);
});

test('tripCashCommitted is pix only for goal donut', () => {
    const s = sumPaymentBreakdown([
        { amount: 100, payment_method: 'pix' },
        { amount: 1200, payment_method: 'credit_card', installment_count: 12 }
    ]);
    assert.equal(tripCashCommitted(s), 100);
    assert.equal(s.committed, 1300);
});

test('installmentCount defaults and clamps', () => {
    assert.equal(installmentCount({}), 1);
    assert.equal(installmentCount({ installments: 0 }), 1);
    assert.equal(installmentCount({ installments: 99 }), 48);
});