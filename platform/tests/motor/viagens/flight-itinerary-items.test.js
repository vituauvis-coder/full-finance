import assert from 'node:assert/strict';
import test from 'node:test';
import {
    applyManagedFlightInjections,
    isManagedFlightItemId,
    managedFlightSimId
} from '../../../../motor/viagens/flight-itinerary-items.js';

test('isManagedFlightItemId detects auto voo/chegada ids', () => {
    assert.equal(isManagedFlightItemId('rote-flight-abc-ida-chegada'), true);
    assert.equal(isManagedFlightItemId('rote-flight-abc-ida-partida'), true);
    assert.equal(isManagedFlightItemId('rote-flight-abc-volta-chegada'), true);
    assert.equal(isManagedFlightItemId('rote-flight-abc-manual'), false);
    assert.equal(isManagedFlightItemId('user-note-1'), false);
});

test('managedFlightSimId extracts simulation id', () => {
    assert.equal(managedFlightSimId('rote-flight-sim-42-ida-chegada'), 'sim-42');
    assert.equal(managedFlightSimId('rote-flight-x-volta-partida'), 'x');
});

test('applyManagedFlightInjections moves chegada to new day and drops stale copy', () => {
    const days = [
        {
            dayKey: '2026-04-19',
            items: [
                {
                    id: 'rote-flight-sim1-ida-partida',
                    title: 'Voo · MAD → PEK',
                    time: '08:00'
                },
                {
                    id: 'rote-flight-sim1-ida-chegada',
                    title: 'Chegada · Pequim (PEK)',
                    time: '10:00'
                },
                { id: 'user-1', title: 'Café', time: '11:00' }
            ]
        },
        {
            dayKey: '2026-04-20',
            items: [{ id: 'user-2', title: 'Passeio', time: '14:00' }]
        }
    ];

    const injections = new Map([
        [
            '2026-04-19',
            [
                {
                    id: 'rote-flight-sim1-ida-partida',
                    title: 'Voo · MAD → PEK',
                    time: '08:00'
                }
            ]
        ],
        [
            '2026-04-20',
            [
                {
                    id: 'rote-flight-sim1-ida-chegada',
                    title: 'Chegada · Pequim (PEK)',
                    time: '05:00'
                }
            ]
        ]
    ]);

    const next = applyManagedFlightInjections(days, injections, {
        dayKeyOf: (d) => d.dayKey
    });

    const d19 = next.find((d) => d.dayKey === '2026-04-19');
    const d20 = next.find((d) => d.dayKey === '2026-04-20');
    assert.ok(d19 && d20);
    assert.equal(
        (d19.items ?? []).filter((i) => i.id === 'rote-flight-sim1-ida-chegada').length,
        0
    );
    assert.equal(
        (d19.items ?? []).filter((i) => i.id === 'rote-flight-sim1-ida-partida').length,
        1
    );
    assert.ok((d19.items ?? []).some((i) => i.id === 'user-1'));
    const chegadas = (d20.items ?? []).filter((i) => i.id === 'rote-flight-sim1-ida-chegada');
    assert.equal(chegadas.length, 1);
    assert.equal(chegadas[0].time, '05:00');
});

test('applyManagedFlightInjections drops auto items for sims no longer injected', () => {
    const days = [
        {
            dayKey: '2026-04-19',
            items: [
                {
                    id: 'rote-flight-old-ida-chegada',
                    title: 'Chegada · PEK',
                    time: '05:00'
                }
            ]
        }
    ];
    const next = applyManagedFlightInjections(days, new Map(), {
        dayKeyOf: (d) => d.dayKey
    });
    assert.equal((next[0].items ?? []).length, 0);
});
