import test from 'node:test';
import assert from 'node:assert/strict';
import {
    cofrinhoBucketDeltaForMovement,
    movementSkipsAccountCashOut
} from '../../../../motor/dinheiro/cofrinho-movement-ledger.js';

test('aporte cofrinho viagem credita caixinha', () => {
    const bucket = { id: 'b1', name: 'Japão', tripId: 't1' };
    const m = {
        category: 'Cofrinhos',
        subcategory: 'Japão',
        tripId: 't1',
        amount: 200,
        isPaid: true
    };
    assert.equal(cofrinhoBucketDeltaForMovement(m, bucket), 200);
});

test('gasto pago do cofrinho debita caixinha viagem', () => {
    const bucket = { id: 'b1', name: 'Japão', tripId: 't1' };
    const m = {
        category: 'Viagens',
        subcategory: 'Japão',
        tripId: 't1',
        amount: 80,
        paidFromCofrinho: true
    };
    assert.equal(cofrinhoBucketDeltaForMovement(m, bucket), -80);
});

test('tipo C não conta em resumo de conta', () => {
    assert.equal(movementSkipsAccountCashOut({ paidFromCofrinho: true }), true);
    assert.equal(movementSkipsAccountCashOut({ category: 'Viagens', amount: 10 }), false);
});

test('gasto do cofrinho casa caixinha pelo nome da viagem quando tripId falta no gasto', () => {
    const bucket = { id: 'b1', name: '1 Trip Internacional', tripId: 't1' };
    const m = {
        category: 'Viagens',
        subcategory: '1 Trip Internacional',
        amount: 143,
        paidFromCofrinho: true,
        isPaid: true
    };
    assert.equal(cofrinhoBucketDeltaForMovement(m, bucket), -143);
});