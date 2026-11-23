import assert from 'node:assert/strict';
import test from 'node:test';
import {
    buildCofrinhoMonthlyYieldEvents,
    cofrinhoNetPrincipalThroughMonth
} from '../../../../motor/dinheiro/cofrinho-monthly-yield.js';

test('cofrinhoNetPrincipalThroughMonth soma aportes e subtrai saídas até o mês', () => {
    const inflows = [
        { bucketId: 'b1', yearMonth: '2025-01', amount: 100, accountId: 'acc-a' },
        { bucketId: 'b1', yearMonth: '2025-02', amount: 50, accountId: 'acc-a' },
        { bucketId: 'b1', yearMonth: '2025-02', amount: 80, accountId: 'acc-b' }
    ];
    const outflows = [{ bucketId: 'b1', yearMonth: '2025-02', amount: 20, accountId: 'acc-a' }];
    assert.equal(cofrinhoNetPrincipalThroughMonth('b1', '2025-02', inflows, outflows), 210);
    assert.equal(cofrinhoNetPrincipalThroughMonth('b1', '2025-02', inflows, outflows, 'acc-a'), 130);
    assert.equal(cofrinhoNetPrincipalThroughMonth('b1', '2025-01', inflows, outflows), 100);
});

test('buildCofrinhoMonthlyYieldEvents agrega contas no mesmo mês', () => {
    const snapshots = [
        {
            id: 's1',
            bucketId: 'b1',
            referenceMonth: '2025-02-01',
            principalAmount: 1000,
            balanceWithYield: 1003,
            accountId: 'a1'
        },
        {
            id: 's2',
            bucketId: 'b1',
            referenceMonth: '2025-02-01',
            principalAmount: 500,
            balanceWithYield: 509,
            accountId: 'a2'
        }
    ];
    const events = buildCofrinhoMonthlyYieldEvents(snapshots);
    assert.equal(events.length, 1);
    assert.equal(events[0].amount, 12);
});

test('buildCofrinhoMonthlyYieldEvents calcula rendimento incremental por mês', () => {
    const snapshots = [
        {
            id: 's1',
            bucketId: 'b1',
            referenceMonth: '2025-01-01',
            principalAmount: 1000,
            balanceWithYield: 1005
        },
        {
            id: 's2',
            bucketId: 'b1',
            referenceMonth: '2025-02-01',
            principalAmount: 1500,
            balanceWithYield: 1512
        }
    ];
    const events = buildCofrinhoMonthlyYieldEvents(snapshots);
    assert.equal(events.length, 2);
    assert.equal(events.find((e) => e.yearMonth === '2025-01')?.amount, 5);
    assert.equal(events.find((e) => e.yearMonth === '2025-02')?.amount, 7);
});