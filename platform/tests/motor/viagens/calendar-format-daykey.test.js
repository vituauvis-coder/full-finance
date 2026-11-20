import test from 'node:test';
import assert from 'node:assert/strict';
import { dayKey, parseDayKey } from '../../../../motor/viagens/calendar-format.js';

test('parseDayKey preserva dia civil BR para YYYY-MM-DD', () => {
    for (const key of ['2027-04-24', '2027-04-25', '2027-04-26', '2027-04-27']) {
        const d = parseDayKey(key);
        assert.ok(d, key);
        assert.equal(dayKey(d), key, `dayKey deve bater com ${key}`);
    }
});