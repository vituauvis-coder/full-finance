import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { sortHopsChronologically } from '../../../../motor/viagens/hops-chronology.js';

describe('sortHopsChronologically', () => {
    it('coloca voos fora de ordem na sequência temporal correta', () => {
        const shuffled = [
            {
                id: 'b',
                originCity: 'Madri',
                destinationCity: 'Recife',
                departsAt: '2026-05-15T11:50',
                arrivesAt: '2026-05-15T15:30'
            },
            {
                id: 'a',
                originCity: 'Recife',
                destinationCity: 'Madri',
                departsAt: '2026-04-17T17:00',
                arrivesAt: '2026-04-18T06:00'
            },
            {
                id: 'd',
                originCity: 'Pequim',
                destinationCity: 'Madri',
                departsAt: '2026-05-14T20:00',
                arrivesAt: '2026-05-15T16:00'
            },
            {
                id: 'c',
                originCity: 'Madri',
                destinationCity: 'Pequim',
                departsAt: '2026-04-18T08:00',
                arrivesAt: '2026-04-19T05:00'
            }
        ];
        const sorted = sortHopsChronologically(shuffled);
        assert.deepEqual(
            sorted.map((h) => h.id),
            ['a', 'c', 'd', 'b']
        );
    });
});