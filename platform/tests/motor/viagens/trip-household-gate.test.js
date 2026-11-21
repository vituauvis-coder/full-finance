import test from 'node:test';
import assert from 'node:assert/strict';
import { canAccessTrip } from '../../../../motor/viagens/trip-household-gate.js';

test('membro da household acessa', () => {
    assert.equal(
        canAccessTrip(
            { householdId: 'h1', userId: 'a' },
            { userId: 'b', householdIds: ['h1'] }
        ),
        true
    );
});

test('fora da household não acessa', () => {
    assert.equal(
        canAccessTrip(
            { householdId: 'h1', userId: 'a' },
            { userId: 'c', householdIds: ['h2'] }
        ),
        false
    );
});

test('legado sem household: só criador', () => {
    assert.equal(
        canAccessTrip({ householdId: null, userId: 'a' }, { userId: 'a', householdIds: [] }),
        true
    );
    assert.equal(
        canAccessTrip({ householdId: null, userId: 'a' }, { userId: 'b', householdIds: [] }),
        false
    );
});
