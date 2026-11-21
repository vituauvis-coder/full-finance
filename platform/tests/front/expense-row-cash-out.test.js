import test from 'node:test';
import assert from 'node:assert/strict';
import {
    getInstallmentDueDates,
    isInstallmentDuePaidForCashOut
} from '../../../motor/dinheiro/credit-installments.js';

test('cartão parcelado: parcela de mês futuro sem cashOut não está paga', () => {
    const purchase = new Date(2026, 9, 5); // 5 out 2026
    const dues = getInstallmentDueDates(purchase, 6, 1, 10);
    assert.ok(dues.length >= 2);
    const decDue = dues.find((d) => d.getFullYear() === 2026 && d.getMonth() === 11);
    assert.ok(decDue, 'deve haver vencimento em dez/2026');

    const expense = {
        date: purchase.toISOString(),
        installmentCount: 6,
        isPaid: true,
        cashOutConfirmedPeriods: JSON.stringify([])
    };
    const account = { type: 'credit', closeDay: 1, dueDay: 10 };
    const now = new Date(2026, 10, 21); // 21 nov 2026
    assert.equal(
        isInstallmentDuePaidForCashOut(expense, account, decDue, null, now),
        false
    );
});
