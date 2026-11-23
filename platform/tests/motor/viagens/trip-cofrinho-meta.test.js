import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTripCofrinhoMeta } from '../../../../motor/viagens/trip-cofrinho-meta.js';

test('buildTripCofrinhoMeta soma rendimento ao saldo do cofrinho', () => {
    const meta = buildTripCofrinhoMeta(
        [
            { ledgerKind: 'aporte', amount: 1000 },
            { ledgerKind: 'gasto_cofrinho', amount: 100 }
        ],
        [
            {
                bucketId: 'b1',
                referenceMonth: '2026-03-01',
                principalAmount: 1000,
                balanceWithYield: 1005
            }
        ]
    );
    assert.equal(meta.aportes, 1000);
    assert.equal(meta.gastosCofrinho, 100);
    assert.equal(meta.rendimento, 5);
    assert.equal(meta.remaining, 905);
});