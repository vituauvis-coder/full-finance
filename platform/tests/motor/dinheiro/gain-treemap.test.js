import assert from 'node:assert/strict';
import { test } from 'node:test';
import { prepareGainsForTreemap } from '../../../../motor/dinheiro/gain-treemap.js';

test('treemap Entradas: referenceOnly no extrato entra no mapa (paridade com a lista)', () => {
    const prepared = prepareGainsForTreemap([
        {
            id: 'g1',
            amount: 2700,
            category: 'Salário',
            subcategory: 'Geral',
            isPaid: true,
            referenceOnly: true
        },
        {
            id: 'g2',
            amount: 587.5,
            category: 'Reembolsos',
            subcategory: 'Geral',
            isPaid: true,
            referenceOnly: false
        }
    ]);
    assert.equal(prepared.length, 2);
    const sum = prepared.reduce((s, r) => s + Number(r.amount), 0);
    assert.ok(Math.abs(sum - 3287.5) < 0.01);
});