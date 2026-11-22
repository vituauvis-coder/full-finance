import test from 'node:test';
import assert from 'node:assert/strict';
import { pickPrimaryCashAccounts } from '../../../../motor/dinheiro/primary-cash-balance.js';

function isCash(type) {
    return type === 'conta_corrente' || type === 'poupanca' || type === 'outros';
}

test('pickPrimaryCashAccounts — nenhuma principal', () => {
    assert.equal(pickPrimaryCashAccounts([], isCash), null);
    assert.equal(
        pickPrimaryCashAccounts([{ id: '1', type: 'conta_corrente', isPrimaryCash: false }], isCash),
        null
    );
});

test('pickPrimaryCashAccounts — uma principal', () => {
    const itau = { id: 'i', name: 'Itaú', type: 'conta_corrente', isPrimaryCash: true };
    assert.deepEqual(pickPrimaryCashAccounts([itau], isCash), [itau]);
});

test('pickPrimaryCashAccounts — duas principais: prefere corrente a outros (MP)', () => {
    const itau = { id: 'i', name: 'Itaú', type: 'conta_corrente', isPrimaryCash: true };
    const mp = { id: 'm', name: 'Mercado Pago', type: 'outros', isPrimaryCash: true };
    assert.deepEqual(pickPrimaryCashAccounts([mp, itau], isCash), [itau]);
});

test('pickPrimaryCashAccounts — principal em investimento é ignorada', () => {
    const inv = { id: 'x', name: 'XP', type: 'investimento', isPrimaryCash: true };
    const mp = { id: 'm', name: 'Mercado Pago', type: 'outros', isPrimaryCash: false };
    assert.equal(pickPrimaryCashAccounts([inv, mp], isCash), null);
});

test('pickPrimaryCashAccounts — principal em cartão não entra no saldo', () => {
    const card = { id: 'c', name: 'Nubank', type: 'cartao_credito', isPrimaryCash: true };
    const mp = { id: 'm', name: 'Mercado Pago', type: 'outros', isPrimaryCash: false };
    assert.equal(pickPrimaryCashAccounts([card, mp], isCash), null);
});