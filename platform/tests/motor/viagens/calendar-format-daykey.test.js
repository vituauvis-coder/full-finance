import test from 'node:test';
import assert from 'node:assert/strict';
import { dayKey, parseDayKey, toApiDayKey } from '../../../../motor/viagens/calendar-format.js';

test('parseDayKey preserva dia civil BR para YYYY-MM-DD', () => {
    for (const key of ['2027-04-24', '2027-04-25', '2027-04-26', '2027-04-27']) {
        const d = parseDayKey(key);
        assert.ok(d, key);
        assert.equal(dayKey(d), key, `dayKey deve bater com ${key}`);
    }
});

test('toApiDayKey não atrasa DATE do Postgres em servidor UTC', () => {
    // node-pg em TZ=UTC: date '2027-04-17' → 2027-04-17T00:00:00.000Z
    const fromPg = new Date(Date.UTC(2027, 3, 17));
    assert.equal(fromPg.toISOString(), '2027-04-17T00:00:00.000Z');
    assert.equal(toApiDayKey(fromPg), '2027-04-17');
    assert.equal(toApiDayKey('2027-04-17T00:00:00.000Z'), '2027-04-17');
    assert.equal(toApiDayKey('2027-04-17'), '2027-04-17');
});