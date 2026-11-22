import test from 'node:test';
import assert from 'node:assert/strict';
import { canAccessTrip } from '../../../../motor/viagens/trip-household-gate.js';

test('qualquer login autenticado acessa viagem de outro usuário', () => {
    assert.equal(
        canAccessTrip(
            { householdId: 'h1', userId: 'a' },
            { userId: 'b', householdIds: ['h2'] }
        ),
        true
    );
});

test('sem viagem ou sem viewer não acessa', () => {
    assert.equal(canAccessTrip(null, { userId: 'a' }), false);
    assert.equal(canAccessTrip({ householdId: 'h1', userId: 'a' }, { userId: '' }), false);
    assert.equal(canAccessTrip({ householdId: 'h1', userId: 'a' }, {}), false);
});