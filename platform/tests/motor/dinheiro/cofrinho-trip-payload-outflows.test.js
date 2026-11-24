import test from 'node:test';
import assert from 'node:assert/strict';
import {
    collectTripPayloadCofrinhoOutflows,
    filterTripPayloadCofrinhoOutflowsForUser
} from '../../../../motor/dinheiro/cofrinho-trip-payload-outflows.js';

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

test('filterTripPayloadCofrinhoOutflowsForUser não vaza saída do cofrinho de outro usuário', () => {
    const raw = collectTripPayloadCofrinhoOutflows([
        {
            id: 'trip-1',
            title: '1 Trip Internacional',
            payload: {
                expenses: [
                    {
                        id: 'te-1',
                        financeExpenseId: 'exp-millena',
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

    const mirrorRows = [
        { id: 'exp-millena', userId: 'u-millena', tripId: 'trip-1', tripExpenseId: 'te-1' }
    ];
    const tripOwnerByTripId = new Map([['trip-1', 'u-millena']]);

    const forMillena = filterTripPayloadCofrinhoOutflowsForUser(raw, {
        userId: 'u-millena',
        mirrorRows,
        tripOwnerByTripId
    });
    assert.equal(forMillena.length, 1);
    assert.equal(forMillena[0].amount, 2070);

    const forOther = filterTripPayloadCofrinhoOutflowsForUser(raw, {
        userId: 'u-outro',
        mirrorRows,
        tripOwnerByTripId
    });
    assert.equal(forOther.length, 0);
});

test('filterTripPayloadCofrinhoOutflowsForUser usa dono da viagem quando não há espelho em expenses', () => {
    const raw = collectTripPayloadCofrinhoOutflows([
        {
            id: 'trip-1',
            payload: {
                expenses: [
                    {
                        id: 'te-legacy',
                        amount: 500,
                        description: 'Visto',
                        spentOn: '2026-01-10',
                        paymentMethod: 'pix',
                        paidFromCofrinho: true
                    }
                ]
            }
        }
    ]);

    const tripOwnerByTripId = new Map([['trip-1', 'u-millena']]);

    assert.equal(
        filterTripPayloadCofrinhoOutflowsForUser(raw, {
            userId: 'u-millena',
            mirrorRows: [],
            tripOwnerByTripId
        }).length,
        1
    );
    assert.equal(
        filterTripPayloadCofrinhoOutflowsForUser(raw, {
            userId: 'u-outro',
            mirrorRows: [],
            tripOwnerByTripId
        }).length,
        0
    );
});
