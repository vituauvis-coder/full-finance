import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sumProjectedGainsForCalendarMonth } from '../../../../motor/dinheiro/projected-gains.js';

test('sumProjectedGainsForCalendarMonth inclui referenceOnly', () => {
    const mo = {
        start: new Date(2026, 1, 1),
        end: new Date(2026, 1, 28, 23, 59, 59, 999)
    };
    const sum = sumProjectedGainsForCalendarMonth(mo, [
        { amount: 1555, date: '2026-02-20', referenceOnly: true },
        { amount: 100, date: '2026-02-10', referenceOnly: false }
    ]);
    assert.equal(sum, 1655);
});