import assert from 'node:assert/strict';
import test from 'node:test';
import { balanceAtEndOfChartMonth } from '../../../../motor/dinheiro/chart-month-balance.js';

test('balanceAtEndOfChartMonth — mês passado usa fetch', async () => {
    const mo = {
        start: new Date(2024, 0, 1),
        end: new Date(2024, 0, 31, 23, 59, 59, 999)
    };
    const now = new Date(2026, 5, 15);
    const bal = await balanceAtEndOfChartMonth(
        mo,
        now,
        async () => 1000,
        [],
        [],
        [],
        null,
        null
    );
    assert.equal(bal, 1000);
});