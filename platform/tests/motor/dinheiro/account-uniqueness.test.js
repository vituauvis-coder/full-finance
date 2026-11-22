import test from 'node:test';
import assert from 'node:assert/strict';
import {
    accountConflictsWithExisting,
    accountUniquenessKey,
    normalizeInstitutionKey
} from '../../../../motor/dinheiro/account-uniqueness.js';

test('normalizeInstitutionKey — Itaú e Itau iguais', () => {
    assert.equal(normalizeInstitutionKey('Itaú'), normalizeInstitutionKey('Itau'));
});

test('accountUniquenessKey — duas correntes mesmo nome e titular colidem', () => {
    const holder = 'user-1';
    const a = { id: 'a', name: 'Itaú', type: 'conta_corrente', holderUserId: holder };
    const b = { id: 'b', name: 'Itau', type: 'conta_corrente', holderUserId: holder };
    assert.equal(accountUniquenessKey(a), accountUniquenessKey(b));
    assert.ok(accountConflictsWithExisting([a], b));
});

test('titulares diferentes não colidem', () => {
    const a = { id: 'a', name: 'Itaú', type: 'conta_corrente', holderUserId: 'u1' };
    const b = { id: 'b', name: 'Itaú', type: 'conta_corrente', holderUserId: 'u2' };
    assert.equal(accountConflictsWithExisting([a], b), null);
});

test('plástico — mesmo nome com vínculos diferentes pode coexistir', () => {
    const holder = 'u1';
    const linked = {
        id: 'c1',
        name: 'Itaú crédito',
        type: 'cartao_credito',
        holderUserId: holder,
        linkedAccountId: 'bank-a'
    };
    const other = {
        id: 'c2',
        name: 'Itaú crédito',
        type: 'cartao_credito',
        holderUserId: holder,
        linkedAccountId: 'bank-b'
    };
    assert.notEqual(accountUniquenessKey(linked), accountUniquenessKey(other));
});