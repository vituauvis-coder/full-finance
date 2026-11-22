import test from 'node:test';
import assert from 'node:assert/strict';
import {
    financeAportesAsDeposits,
    tripCofrinhoTotalsFromFinance
} from '../../../../motor/viagens/trip-cofrinho-finance.js';

test('tripCofrinhoTotalsFromFinance soma aportes e debita gastos do cofrinho', () => {
    const t = tripCofrinhoTotalsFromFinance([
        { ledgerKind: 'aporte', amount: 300 },
        { ledgerKind: 'aporte', amount: 100 },
        { ledgerKind: 'gasto_cofrinho', amount: 80 },
        { ledgerKind: 'gasto', amount: 200 }
    ]);
    assert.equal(t.aportes, 400);
    assert.equal(t.gastosCofrinho, 80);
    assert.equal(t.remaining, 320);
});

test('financeAportesAsDeposits mapeia linhas para histórico', () => {
    const d = financeAportesAsDeposits([
        { id: 'e1', ledgerKind: 'aporte', amount: 50, date: '2026-03-15', description: 'Aporte' }
    ]);
    assert.equal(d.length, 1);
    assert.equal(d[0].id, 'finance::e1');
    assert.equal(d[0].monthKey, '2026-03');
});