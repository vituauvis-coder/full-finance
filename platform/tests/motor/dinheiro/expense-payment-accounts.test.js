import assert from 'node:assert/strict';
import test from 'node:test';
import { accountEligibleForExpensePix } from '../../../../motor/dinheiro/expense-payment-accounts.js';

test('pagamento PIX: sem cofrinho nem investimento', () => {
    assert.equal(accountEligibleForExpensePix({ type: 'conta_corrente' }), true);
    assert.equal(accountEligibleForExpensePix({ type: 'cofrinho' }), false);
    assert.equal(accountEligibleForExpensePix({ type: 'investimento' }), false);
    assert.equal(accountEligibleForExpensePix({ type: 'cartao_credito' }), false);
});