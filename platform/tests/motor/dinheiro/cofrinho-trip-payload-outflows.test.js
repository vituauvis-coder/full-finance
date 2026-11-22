import test from 'node:test';
import assert from 'node:assert/strict';
import { collectTripPayloadCofrinhoOutflows } from '../../../../motor/dinheiro/cofrinho-trip-payload-outflows.js';

test('lê gasto debitar da meta no payload da viagem', () => {
    const rows = collectTripPayloadCofrinhoOutflows([
        {
            id: 'trip-1',
            payload: {
                expenses: [
                    {
                        id: 'te-1',
                        amount: 2070,
                        description: 'Taxa iberia',
                        spentOn: '2025-11-18',
                        paymentMethod: 'pix',
                        paidFromCofrinho: true
                    }
                ]
            }
        }
    ]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].tripId, 'trip-1');
    assert.equal(rows[0].amount, 2070);
    assert.equal(rows[0].description, 'Taxa iberia');
});