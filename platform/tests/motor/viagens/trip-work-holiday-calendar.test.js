import test from 'node:test';
import assert from 'node:assert/strict';
import {
    brazilHolidayName,
    brazilNationalDayKeys,
    workHolidayNameByDay
} from '../../../../motor/viagens/trip-work-holiday-calendar.js';
import { parseDayKey } from '../../../../motor/viagens/calendar-format.js';

test('inclui Tiradentes (21 abr) no intervalo', () => {
    const from = parseDayKey('2026-04-01');
    const to = parseDayKey('2026-04-30');
    const keys = brazilNationalDayKeys(from, to);
    assert.ok(keys.has('2026-04-21'));
});

test('brazilHolidayName nomeia Tiradentes', () => {
    assert.equal(brazilHolidayName('2026-04-21'), 'Tiradentes');
    assert.equal(brazilHolidayName('2026-12-25'), 'Natal');
});

test('workHolidayNameByDay mapeia 21/04', () => {
    const map = workHolidayNameByDay(
        new Date('2026-04-10T12:00:00'),
        new Date('2026-04-30T12:00:00'),
        'America/Recife'
    );
    assert.equal(map.get('2026-04-21'), 'Tiradentes');
});