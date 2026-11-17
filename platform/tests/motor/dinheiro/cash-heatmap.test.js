import assert from 'node:assert/strict';
import test from 'node:test';
import { buildMonthDayMap, buildDayDetailItems } from '../../../../motor/dinheiro/cash-heatmap.js';

test('buildMonthDayMap agrega saída no dia civil', () => {
    const year = 2026;
    const monthIndex = 0;
    const expenses = [{ id: 'e1', amount: 100, date: '2026-01-10T15:00:00', accountId: 'a1' }];
    const map = buildMonthDayMap(expenses, [], [{ id: 'a1', name: 'Conta', type: 'conta_corrente' }], year, monthIndex);
    assert.equal(map.get(10)?.totalSaida, 100);
});

test('buildDayDetailItems inclui fatura no vencimento', () => {
    const accounts = [{ id: 'c1', name: 'Nubank', type: 'cartao_credito', dueDay: 15 }];
    const expenses = [{ id: 'e1', amount: 50, date: '2026-01-05', accountId: 'c1' }];
    const items = buildDayDetailItems(expenses, [], accounts, 2026, 0, 15);
    assert.ok(items.some((i) => i.kind === 'invoice'));
});