import test from 'node:test';
import assert from 'node:assert/strict';
import {
    isCofrinhoDepositFromAccount,
    isCofrinhoWithdrawalOnAccount,
    summarizeWalletAccountCofrinho
} from '../../../../motor/dinheiro/wallet-account-cofrinho.js';

test('aporte cofrinho na conta', () => {
    assert.equal(
        isCofrinhoDepositFromAccount({
            category: 'Cofrinhos',
            isPaid: true,
            amount: 100,
            accountId: 'bank-1'
        }),
        true
    );
});

test('gasto pago do cofrinho não é aporte', () => {
    assert.equal(
        isCofrinhoDepositFromAccount({
            category: 'Viagens',
            paidFromCofrinho: true,
            isPaid: true,
            amount: 50,
            accountId: 'bank-1'
        }),
        false
    );
    assert.equal(
        isCofrinhoWithdrawalOnAccount({
            category: 'Viagens',
            paidFromCofrinho: true,
            amount: 50,
            accountId: 'bank-1'
        }),
        true
    );
});

test('resumo ignora mês e acumula na vida', () => {
    const r = summarizeWalletAccountCofrinho(
        [
            {
                category: 'Cofrinhos',
                isPaid: true,
                amount: 200,
                accountId: 'bank-1',
                date: '2025-01-15'
            },
            {
                category: 'Cofrinhos',
                isPaid: true,
                amount: 80,
                accountId: 'bank-1',
                date: '2026-11-10'
            },
            {
                category: 'Viagens',
                paidFromCofrinho: true,
                isPaid: true,
                amount: 30,
                accountId: 'bank-1',
                date: '2026-11-12'
            }
        ],
        new Set(['bank-1']),
        { year: 2026, monthIndex: 10 }
    );
    assert.equal(r.accumulated, 280);
    assert.equal(r.withdrawn, 30);
    assert.equal(r.net, 250);
    assert.equal(r.monthAccumulated, 80);
    assert.equal(r.monthWithdrawn, 30);
    assert.equal(r.lastEventAt, '2026-11-12');
});