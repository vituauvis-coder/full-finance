import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { countryStayWindow, parseHopInstant } from '../../../../motor/viagens/country-schedule.js';

describe('countryStayWindow', () => {
    it('passagem 1 noite: chega dia 2, sai dia 3 cedo', () => {
        const arrive = parseHopInstant('2026-03-02T18:00');
        const leave = parseHopInstant('2026-03-03T09:00');
        const stay = countryStayWindow(arrive, leave);
        assert.equal(stay.days, 1);
        assert.equal(stay.isLayoverOnly, true);
    });

    it('estadia 5 noites entre datas', () => {
        const arrive = parseHopInstant('2026-03-01T14:00');
        const leave = parseHopInstant('2026-03-06T10:00');
        const stay = countryStayWindow(arrive, leave);
        assert.equal(stay.days, 5);
        assert.equal(stay.isLayoverOnly, false);
    });
});