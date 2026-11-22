import test from 'node:test';
import assert from 'node:assert/strict';
import {
    enrichInstitutionWalletFunctions,
    cashBalanceAccountForDisplay
} from '../../../../motor/dinheiro/wallet-institution-functions.js';

test('enrichInstitutionWalletFunctions — corrente + crédito vinculado', () => {
    const bank = {
        id: 'bank-1',
        name: 'Itaú',
        type: 'conta_corrente',
        walletFunctions: ['bank']
    };
    const card = {
        id: 'card-1',
        name: 'Itaú',
        type: 'cartao_credito',
        linkedAccountId: 'bank-1',
        walletFunctions: []
    };
    const [out] = enrichInstitutionWalletFunctions([bank, card]);
    assert.ok(out.walletFunctions.includes('bank'));
    assert.ok(out.walletFunctions.includes('credit'));
});

test('cashBalanceAccountForDisplay — saldo na instituição, não no plástico', () => {
    const bank = { id: 'b', type: 'conta_corrente', name: 'Itaú' };
    const card = { id: 'c', type: 'cartao_credito', linkedAccountId: 'b', name: 'Itaú' };
    assert.equal(cashBalanceAccountForDisplay(card, [bank, card]).id, 'b');
});