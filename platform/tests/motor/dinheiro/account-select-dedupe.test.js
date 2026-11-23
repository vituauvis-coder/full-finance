import test from 'node:test';
import assert from 'node:assert/strict';
import {
    accountEligibleForSplitCredit,
    dedupeAccountsByInstitutionName
} from '../../../../motor/dinheiro/account-select-dedupe.js';

test('estorno: não inclui cartão', () => {
    assert.equal(accountEligibleForSplitCredit({ type: 'cartao_credito' }), false);
    assert.equal(accountEligibleForSplitCredit({ type: 'conta_corrente' }), true);
});

test('dedupe por nome de instituição', () => {
    const rows = dedupeAccountsByInstitutionName([
        { id: 'a1', name: 'Itaú (Millena Santos)', type: 'conta_corrente' },
        { id: 'a2', name: 'Itaú (Millena Santos)', type: 'conta_corrente' },
        { id: 'b1', name: 'Inter (PJ)', type: 'conta_corrente' },
        { id: 'b2', name: 'Inter (PJ)', type: 'outros' }
    ]);
    assert.equal(rows.length, 2);
    assert.ok(rows.some((r) => r.id === 'a1'));
    assert.equal(rows.find((r) => normalizeName(r.name) === 'inter (pj)').id, 'b1');
});

function normalizeName(n) {
    return String(n).toLowerCase();
}