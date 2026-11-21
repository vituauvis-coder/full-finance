import test from 'node:test';
import assert from 'node:assert/strict';
import { dedupeRatesByPair } from '../../../../motor/viagens/miles-rates-household.js';

test('dedupeRatesByPair fica com a taxa mais nova do mesmo par', () => {
    const out = dedupeRatesByPair([
        {
            fromProgramId: 'a',
            toProgramId: 'b',
            conversionFrom: 1,
            conversionTo: 1,
            updatedAt: '2026-01-01T00:00:00.000Z'
        },
        {
            fromProgramId: 'a',
            toProgramId: 'b',
            conversionFrom: 2,
            conversionTo: 3,
            updatedAt: '2026-06-01T00:00:00.000Z'
        },
        {
            fromProgramId: 'a',
            toProgramId: 'c',
            conversionFrom: 1,
            conversionTo: 1,
            updatedAt: '2026-02-01T00:00:00.000Z'
        }
    ]);
    assert.equal(out.length, 2);
    const ab = out.find((r) => r.toProgramId === 'b');
    assert.equal(ab.conversionFrom, 2);
    assert.equal(ab.conversionTo, 3);
});
