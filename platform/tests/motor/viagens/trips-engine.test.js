import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
    effectiveStatus,
    spent,
    tripTotal,
    citySpent,
    capUsedFraction,
    sortedTrips,
    flightCompare
} from '../../../../motor/viagens/trips-engine.js';

const now = new Date('2026-06-15T12:00:00-03:00');

function makeTrip(overrides = {}) {
    return {
        id: randomUUID(),
        title: 'Nova viagem',
        startsOn: null,
        endsOn: null,
        budgetCaps: {},
        payload: { destinations: [], expenses: [], stays: [], legs: [] },
        ...overrides
    };
}

test('effectiveStatus before start is planejada', () => {
    assert.equal(
        effectiveStatus({ startsOn: '2026-07-01', endsOn: '2026-07-10', statusOverride: null, now }),
        'planejada'
    );
});

test('effectiveStatus override wins', () => {
    assert.equal(
        effectiveStatus({ startsOn: '2026-07-01', endsOn: '2026-07-10', statusOverride: 'realizada', now }),
        'realizada'
    );
});

test('city and trip totals do not duplicate stay', () => {
    const lisboa = randomUUID();
    const trip = makeTrip({
        payload: {
            destinations: [
                { id: lisboa, name: 'Lisboa', latitude: 38.72, longitude: -9.14 },
                { id: randomUUID(), name: 'Paris', latitude: 48.85, longitude: 2.35 }
            ],
            expenses: [
                {
                    id: randomUUID(),
                    title: 'Jantar',
                    amount: 200,
                    date: '2026-07-02',
                    category: 'comida',
                    destinationId: lisboa
                }
            ],
            stays: [{ id: randomUUID(), name: 'Hotel', destinationId: lisboa, amount: 1000 }],
            legs: [{ id: randomUUID(), kind: 'voo', amount: 3000, tripDestinationId: lisboa }]
        }
    });
    assert.equal(citySpent(trip, lisboa), 4200);
    assert.equal(tripTotal(trip), 4200);
    assert.equal(spent(trip, { category: 'hospedagem' }), 1000);
});

test('sort puts em curso first', () => {
    const current = makeTrip({ title: 'Agora', startsOn: '2026-06-01', endsOn: '2026-06-20' });
    const upcoming = makeTrip({ title: 'Depois', startsOn: '2026-08-01', endsOn: '2026-08-10' });
    const past = makeTrip({ title: 'Antes', startsOn: '2025-01-01', endsOn: '2025-01-08' });
    const sorted = sortedTrips([past, upcoming, current], now);
    assert.deepEqual(
        sorted.map((t) => t.title),
        ['Agora', 'Depois', 'Antes']
    );
});

test('capUsedFraction', () => {
    const dest = randomUUID();
    const trip = makeTrip({
        budgetCaps: { comida: 100 },
        payload: {
            destinations: [{ id: dest, name: 'X', latitude: 0, longitude: 0 }],
            expenses: [
                {
                    id: randomUUID(),
                    title: 'A',
                    amount: 40,
                    date: '2026-01-01',
                    category: 'comida',
                    destinationId: dest
                }
            ]
        }
    });
    assert.equal(capUsedFraction(trip), 0.4);
});

test('flightCompare ignores discarded', () => {
    const cheapId = randomUUID();
    const cheap = {
        id: cheapId,
        amount: 9430,
        extrasAmount: 650,
        status: 'candidata',
        connections: [{ place: 'Madrid' }],
        destination: 'Pequim'
    };
    const mid = {
        id: randomUUID(),
        amount: 10840,
        extrasAmount: 750,
        status: 'candidata',
        connections: [{ place: 'Lisboa' }]
    };
    const discarded = { id: randomUUID(), amount: 100, extrasAmount: 10, status: 'descartada' };
    const stats = flightCompare([cheap, mid, discarded]);
    assert.equal(stats.mappedCount, 2);
    assert.equal(stats.cheapestFinal, 10080);
    assert.equal(stats.cheapestHub, 'Madrid');
});