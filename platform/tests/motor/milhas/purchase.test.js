import test from 'node:test';
import assert from 'node:assert/strict';
import { purchaseCost } from '../../../../motor/milhas/purchase.js';

test('purchase 50000 pts at milheiro 14 with 20% off totals 560', () => {
    const r = purchaseCost({ points: 50000, milheiro: 14, discountPercent: 20, extraFee: 0 });
    assert.equal(r.gross.toString(), '700');
    assert.equal(r.total.toString(), '560');
    assert.equal(r.costPerMilheiro.toString(), '11.2');
    assert.equal(r.costPerPoint.toString(), '0.0112');
});

test('extra fee adds to total after discount', () => {
    const r = purchaseCost({ points: 1000, milheiro: 10, discountPercent: 0, extraFee: 5 });
    assert.equal(r.total.toString(), '15');
});
