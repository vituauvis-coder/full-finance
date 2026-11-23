import assert from 'node:assert/strict';
import test from 'node:test';
import { formatMoneyDraft, parseMoneyInput } from '../../../../motor/dinheiro/parse-money-input.js';

test('parseMoneyInput aceita vírgula decimal (pt-BR)', () => {
    assert.equal(parseMoneyInput('6.152,67'), 6152.67);
    assert.equal(parseMoneyInput('6152,67'), 6152.67);
});

test('parseMoneyInput aceita ponto decimal', () => {
    assert.equal(parseMoneyInput('5882.00'), 5882);
    assert.equal(parseMoneyInput('5882,00'), 5882);
});

test('formatMoneyDraft', () => {
    assert.equal(formatMoneyDraft(5882), '5882,00');
});