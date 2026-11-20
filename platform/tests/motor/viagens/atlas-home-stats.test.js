import test from 'node:test';
import assert from 'node:assert/strict';
import { atlasHomeTripStats, atlasHomeStatusSegments } from '../../../../motor/viagens/atlas-home-stats.js';

test('atlasHomeTripStats agrega duração e status', () => {
    const now = new Date('2026-06-15T12:00:00-03:00');
    const trips = [
        {
            startsOn: '2026-01-01',
            endsOn: '2026-01-05',
            statusOverride: null,
            payload: { destinations: [{ kind: 'city' }, { kind: 'home' }] }
        },
        {
            startsOn: '2026-07-01',
            endsOn: '2026-07-11',
            statusOverride: null,
            payload: { destinations: [] }
        }
    ];
    const stats = atlasHomeTripStats(trips, now);
    assert.equal(stats.totalTrips, 2);
    assert.equal(stats.tripsWithDates, 2);
    assert.equal(stats.averageDurationDays, 8);
    assert.equal(stats.destinationCount, 1);
    assert.equal(stats.statusCounts.realizada, 1);
    assert.equal(stats.statusCounts.planejada, 1);
});

test('atlasHomeStatusSegments normaliza frações', () => {
    const segs = atlasHomeStatusSegments({ planejada: 2, em_curso: 1, realizada: 1 }, 4);
    assert.equal(segs[0].fraction, 0.5);
    assert.equal(segs[2].count, 1);
});