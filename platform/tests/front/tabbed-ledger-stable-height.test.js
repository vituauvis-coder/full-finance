import assert from 'node:assert/strict';
import test from 'node:test';
import {
    ledgerTabBodyRowCount,
    maxLedgerTabBodyRows
} from '../../../front/src/lib/tabbedLedgerStableHeight.ts';

test('ledgerTabBodyRowCount usa 1 quando a aba está vazia', () => {
    assert.equal(ledgerTabBodyRowCount(0, 0, 0), 1);
});

test('ledgerTabBodyRowCount reflete o slice da página', () => {
    assert.equal(ledgerTabBodyRowCount(40, 0, 25), 25);
    assert.equal(ledgerTabBodyRowCount(5, 0, 5), 5);
});

test('maxLedgerTabBodyRows pega o maior entre abas', () => {
    assert.equal(maxLedgerTabBodyRows([3, 25, 1]), 25);
});