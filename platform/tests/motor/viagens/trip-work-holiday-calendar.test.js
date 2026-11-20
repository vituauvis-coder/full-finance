import test from 'node:test';
import assert from 'node:assert/strict';
import { brazilNationalDayKeys } from '../../../../motor/viagens/trip-work-holiday-calendar.js';
import { parseDayKey } from '../../../../motor/viagens/calendar-format.js';

test('inclui Tiradentes (21 abr) no intervalo', () => {
    const from = parseDayKey('2026-04-01');
    const to = parseDayKey('2026-04-30');
    const keys = brazilNationalDayKeys(from, to);
    assert.ok(keys.has('2026-04-21'));
});