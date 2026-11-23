import test from 'node:test';
import assert from 'node:assert/strict';
import { supplementTripAportesFromCofrinhoLedger } from '../../../../motor/viagens/trip-cofrinho-supplement-aportes.js';

test('supplementTripAportesFromCofrinhoLedger inclui aplicação na caixinha da viagem', () => {
    const rows = supplementTripAportesFromCofrinhoLedger(
        'trip-1',
        [{ id: 'b1', tripId: 'trip-1', name: 'Europa' }],
        [
            {
                id: 'app1',
                bucketId: 'b1',
                amount: 500,
                referenceMonth: '2026-01-01',
                allocatedExpenseId: 'exp-alloc'
            }
        ],
        [],
        new Set()
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0].id, 'exp-alloc');
    assert.equal(rows[0].amount, 500);
});

test('supplementTripAportesFromCofrinhoLedger ignora id já listado', () => {
    const rows = supplementTripAportesFromCofrinhoLedger(
        'trip-1',
        [{ id: 'b1', tripId: 'trip-1', name: 'Europa' }],
        [{ id: 'app1', bucketId: 'b1', amount: 100, referenceMonth: '2026-02-01' }],
        [],
        new Set(['cofrinho-app-app1'])
    );
    assert.equal(rows.length, 0);
});