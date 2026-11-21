import assert from 'node:assert/strict';
import test from 'node:test';
import {
    shouldPostSplitReimbursementOnAccept,
    shouldPostSplitReimbursementOnRecipientPaid
} from '../../../../motor/dinheiro/split-reimbursement-on-accept.js';

test('aceite pendente (destinatário não pagou) NÃO lança estorno', () => {
    const d = shouldPostSplitReimbursementOnAccept({
        sourcePaymentType: 'conta_corrente',
        splitScope: 'FULL_EXPENSE',
        sourceInstallmentCount: 1,
        recipientExpenseIsPaid: false
    });
    assert.equal(d.post, false);
    assert.equal(d.settle, false);
    assert.equal(d.reason, 'recipient_unpaid');
});

test('aceite com parte do destinatário já paga lança estorno', () => {
    const d = shouldPostSplitReimbursementOnAccept({
        sourcePaymentType: 'conta_corrente',
        splitScope: 'FULL_EXPENSE',
        sourceInstallmentCount: 1,
        recipientExpenseIsPaid: true
    });
    assert.equal(d.post, true);
    assert.equal(d.settle, true);
    assert.equal(d.reason, 'recipient_paid');
});

test('cartão de crédito nunca lança estorno no aceite', () => {
    const d = shouldPostSplitReimbursementOnAccept({
        sourcePaymentType: 'cartao_credito',
        splitScope: 'FULL_EXPENSE',
        sourceInstallmentCount: 1,
        recipientExpenseIsPaid: true
    });
    assert.equal(d.post, false);
    assert.equal(d.reason, 'credit_card');
});

test('parcelado FULL adia estorno (por confirmação de parcela)', () => {
    const d = shouldPostSplitReimbursementOnAccept({
        sourcePaymentType: 'conta_corrente',
        splitScope: 'FULL_EXPENSE',
        sourceInstallmentCount: 3,
        recipientExpenseIsPaid: true
    });
    assert.equal(d.post, false);
    assert.equal(d.reason, 'defer_installments');
});

test('marcar pago depois do aceite lança estorno se ainda não houver gain', () => {
    const d = shouldPostSplitReimbursementOnRecipientPaid({
        sourcePaymentType: 'conta_corrente',
        splitScope: 'FULL_EXPENSE',
        sourceInstallmentCount: 1,
        splitStatus: 'ACCEPTED',
        alreadyHasGain: false
    });
    assert.equal(d.post, true);
    assert.equal(d.reason, 'recipient_marked_paid');
});

test('marcar pago não relança se já existir gain', () => {
    const d = shouldPostSplitReimbursementOnRecipientPaid({
        sourcePaymentType: 'conta_corrente',
        splitScope: 'FULL_EXPENSE',
        sourceInstallmentCount: 1,
        splitStatus: 'ACCEPTED',
        alreadyHasGain: true
    });
    assert.equal(d.post, false);
    assert.equal(d.reason, 'already_posted');
});
