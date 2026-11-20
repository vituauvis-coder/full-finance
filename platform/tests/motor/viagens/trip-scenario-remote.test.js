import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRemoteSnapshot } from '../../../../motor/viagens/trip-scenario-remote.js';
import { snapshot } from '../../../../motor/viagens/trip-scenario-engine.js';

test('conta dias remotos em dias úteis após férias, fora de voos tarde', () => {
    const scenario = {
        id: 's1',
        name: 'Teste',
        vacations: [{ id: 'v1', startsOn: '2026-04-16', days: 18 }],
        remote: { authorization: 'authorized', weekdays: [2, 3, 4, 5, 6], suggestEligibleWeekdays: true },
        hops: [
            {
                id: 'h1',
                departsAt: '2026-04-15T10:00:00',
                arrivesAt: '2026-04-16T08:00:00',
                destinationCountry: 'Espanha'
            },
            {
                id: 'h2',
                departsAt: '2026-04-17T14:00:00',
                arrivesAt: '2026-04-18T06:00:00',
                destinationCountry: 'China'
            },
            {
                id: 'h3',
                departsAt: '2026-05-14T10:00:00',
                arrivesAt: '2026-05-15T08:00:00',
                destinationCountry: 'Brasil'
            }
        ]
    };
    const snap = snapshot(scenario);
    assert.ok(snap.remote.possibleWeekdays > 0, 'deveria haver dias remotos possíveis');
    assert.ok((snap.remote.byCountry.China ?? 0) > 0, 'China deveria ter remotos');
});

test('remoto bloqueado quando não autorizado', () => {
    const scenario = {
        id: 's2',
        name: 'Bloq',
        remote: { authorization: 'not_allowed' },
        hops: [
            {
                id: 'h1',
                departsAt: '2026-04-01T10:00:00',
                arrivesAt: '2026-04-10T10:00:00',
                destinationCountry: 'Portugal'
            }
        ]
    };
    const { remote } = buildRemoteSnapshot(
        scenario,
        new Date('2026-04-01T10:00:00'),
        new Date('2026-04-10T10:00:00')
    );
    assert.equal(remote.possibleWeekdays, 0);
});