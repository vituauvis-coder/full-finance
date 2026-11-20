import test from 'node:test';
import assert from 'node:assert/strict';
import { categoryLedgerItems } from '../../../../motor/viagens/trip-category-ledger.js';

test('categoryLedgerItems merges expenses, stays and legs', () => {
    const trip = {
        payload: {
            expenses: [
                {
                    id: 'e1',
                    description: 'Jantar',
                    amount: 80,
                    category: 'comida',
                    paymentMethod: 'pix',
                    spentOn: '2026-03-02'
                }
            ],
            stays: [{ id: 's1', name: 'Hotel', amount: 500, destinationId: 'd1' }],
            legs: [
                {
                    id: 'l1',
                    amount: 2000,
                    tripDestinationId: 'd1',
                    fromName: 'GRU',
                    toName: 'LIS'
                }
            ]
        }
    };
    const comida = categoryLedgerItems(trip, { category: 'comida' });
    assert.equal(comida.length, 1);
    assert.equal(comida[0].title, 'Jantar');

    const hosp = categoryLedgerItems(trip, { category: 'hospedagem' });
    assert.equal(hosp.length, 1);
    assert.equal(hosp[0].source, 'ficha · hospedagem');

    const voos = categoryLedgerItems(trip, { category: 'transporte' });
    assert.equal(voos.length, 1);
    assert.equal(voos[0].title, 'GRU → LIS');
});