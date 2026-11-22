import assert from 'node:assert/strict';
import test from 'node:test';
import { bucketKindForWrite, normalizeUserCofrinhoKind } from '../../../../motor/dinheiro/cofrinho-bucket-kind.js';

test('normalizeUserCofrinhoKind cai em objetivo', () => {
    assert.equal(normalizeUserCofrinhoKind('investimento'), 'investimento');
    assert.equal(normalizeUserCofrinhoKind('invalid'), 'objetivo');
});

test('bucketKindForWrite trava viagem', () => {
    const existing = { kind: 'viagem', tripId: 't1' };
    assert.equal(bucketKindForWrite({ kind: 'investimento' }, existing), 'viagem');
});

test('bucketKindForWrite aceita viagem com tripId no body', () => {
    assert.equal(bucketKindForWrite({ kind: 'objetivo', tripId: 't2' }, null), 'viagem');
    assert.equal(bucketKindForWrite({ kind: 'viagem' }, null), 'viagem');
});