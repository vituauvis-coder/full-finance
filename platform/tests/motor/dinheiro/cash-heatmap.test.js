import assert from 'node:assert/strict';
import test from 'node:test';
import {
    buildDayDetailItems,
    buildInvoicesByDueDay,
    buildMonthDayMap,
    buildYearMonthMap
} from '../../../../motor/dinheiro/cash-heatmap.js';

test('buildYearMonthMap soma saídas do mês civil', () => {
    const accounts = [{ id: 'a1', name: 'Conta', type: 'conta_corrente' }];
    const expenses = [
        { id: 'e1', amount: 40, date: '2026-01-05', accountId: 'a1' },
        { id: 'e2', amount: 60, date: '2026-01-20', accountId: 'a1' },
        { id: 'e3', amount: 30, date: '2026-02-10', accountId: 'a1' }
    ];
    const map = buildYearMonthMap(expenses, [], accounts, 2026);
    assert.equal(map.get(0)?.totalSaida, 100);
    assert.equal(map.get(1)?.totalSaida, 30);
});

test('buildMonthDayMap agrega saída no dia civil', () => {
    const year = 2026;
    const monthIndex = 0;
    const expenses = [{ id: 'e1', amount: 100, date: '2026-01-10T15:00:00', accountId: 'a1' }];
    const map = buildMonthDayMap(expenses, [], [{ id: 'a1', name: 'Conta', type: 'conta_corrente' }], year, monthIndex);
    assert.equal(map.get(10)?.totalSaida, 100);
});

test('buildDayDetailItems inclui fatura no vencimento', () => {
    const accounts = [{ id: 'c1', name: 'Nubank', type: 'cartao_credito', dueDay: 15, closeDay: 1 }];
    const expenses = [{ id: 'e1', amount: 50, date: '2025-12-20', accountId: 'c1' }];
    const onDue = buildDayDetailItems(expenses, [], accounts, 2026, 0, 15);
    const inv = onDue.find((i) => i.kind === 'invoice');
    assert.ok(inv);
    assert.equal(inv.amount, 50);
    const onPurchase = buildDayDetailItems(expenses, [], accounts, 2026, 0, 5);
    assert.equal(onPurchase.filter((i) => i.kind === 'expense').length, 0);
});

test('buildInvoicesByDueDay omite fatura zerada', () => {
    const accounts = [
        { id: 'c1', name: 'Vazio', type: 'cartao_credito', dueDay: 10, closeDay: 1 },
        { id: 'c2', name: 'Ativo', type: 'cartao_credito', dueDay: 12, closeDay: 1 }
    ];
    const expenses = [{ id: 'e1', amount: 80, date: '2026-01-28', accountId: 'c2' }];
    const map = buildInvoicesByDueDay(accounts, expenses, 2026, 1);
    const all = [...map.values()].flat();
    assert.equal(all.length, 1);
    assert.equal(all[0].cardName, 'Ativo');
    assert.equal(all[0].amount, 80);
});