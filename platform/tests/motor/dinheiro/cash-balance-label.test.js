import test from 'node:test';
import assert from 'node:assert/strict';
import {
    cashBalanceLabelPenalty,
    linkedPlasticCountForInstitution
} from '../../../../motor/dinheiro/cash-balance-label.js';

test('cashBalanceLabelPenalty — Mercado Pago e Caju são auxiliares', () => {
    assert.equal(cashBalanceLabelPenalty('Mercado Pago'), 1);
    assert.equal(cashBalanceLabelPenalty('Caju'), 1);
    assert.equal(cashBalanceLabelPenalty('Itaú'), 0);
});

test('linkedPlasticCountForInstitution', () => {
    const bank = { id: 'b1', name: 'Itaú' };
    const card = { id: 'c1', linkedAccountId: 'b1' };
    assert.equal(linkedPlasticCountForInstitution('b1', [bank, card]), 1);
});