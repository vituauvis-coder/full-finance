import assert from 'node:assert/strict';
import test from 'node:test';
import { enumerateCalendarMonths, isProjectionMonth } from '../../../../motor/dinheiro/calendar-month.js';

test('enumerateCalendarMonths — ano civil completo', () => {
    const months = enumerateCalendarMonths(new Date(2026, 0, 1), new Date(2026, 11, 31));
    assert.equal(months.length, 12);
    assert.equal(months[0].start.getMonth(), 0);
    assert.equal(months[11].start.getMonth(), 11);
});

test('isProjectionMonth — mês após referência', () => {
    const mo = { start: new Date(2026, 5, 1), end: new Date(2026, 5, 30) };
    const ref = new Date(2026, 3, 15);
    assert.equal(isProjectionMonth(mo, ref), true);
});