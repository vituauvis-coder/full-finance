import test from 'node:test';
import assert from 'node:assert/strict';
import { dedupeExpensesByTripExpenseId } from '../../../../motor/dinheiro/dedupe-household-trip-expenses.js';

test('dedupe: dois espelhos do mesmo gasto de viagem na casa', () => {
    const rows = dedupeExpensesByTripExpenseId(
        [
            {
                id: 'e-old',
                tripId: 'trip-1',
                tripExpenseId: 'te1',
                amount: 2070,
                description: 'Taxa iberia',
                createdAt: '2026-11-18T10:00:00.000Z'
            },
            {
                id: 'e-new',
                tripId: 'trip-1',
                tripExpenseId: 'te1',
                amount: 2070,
                description: 'Taxa iberia',
                createdAt: '2026-11-18T12:00:00.000Z'
            },
            {
                id: 'e-other',
                tripId: 'trip-1',
                amount: 50,
                description: 'Outro'
            }
        ],
        new Map([['te1', 'e-old']])
    );
    assert.equal(rows.length, 2);
    assert.equal(rows.find((r) => r.tripExpenseId === 'te1')?.id, 'e-old');
});