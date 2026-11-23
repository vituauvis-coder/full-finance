import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sumInPeriod } from '../../../../motor/dinheiro/dashboard-period.js';

test('sumInPeriod: referenceOnly entra no total do dashboard (paridade com extrato)', () => {
    const start = new Date(2026, 1, 1);
    const end = new Date(2026, 1, 28, 23, 59, 59, 999);
    const total = sumInPeriod(
        [
            { amount: 2700, date: '2026-02-09', referenceOnly: true },
            { amount: 587.5, date: '2026-02-20', referenceOnly: false }
        ],
        start,
        end,
        () => true
    );
    assert.ok(Math.abs(total - 3287.5) < 0.01);
});