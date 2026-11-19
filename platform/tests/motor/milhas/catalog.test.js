import test from 'node:test';
import assert from 'node:assert/strict';
import { rateForPair, suggestedRate, unitLabel } from '../../../../motor/milhas/catalog.js';

test('Esfera pontos → Avios suggests 2:1', () => {
    assert.deepEqual(suggestedRate('pontos', 'avios'), { from: 2, to: 1 });
});

test('Avios → pontos suggests the inverse 1:2', () => {
    assert.deepEqual(suggestedRate('avios', 'pontos'), { from: 1, to: 2 });
});

test('same unit is 1:1', () => {
    assert.deepEqual(suggestedRate('milhas', 'milhas'), { from: 1, to: 1 });
});

test('saved pair rate wins over the suggestion', () => {
    const r = rateForPair(
        { conversionFrom: 1, conversionTo: 2, bonusPercent: 40 },
        'pontos',
        'avios'
    );
    assert.equal(r.from, 1);
    assert.equal(r.to, 2);
    assert.equal(r.bonusPercent, 40);
    assert.equal(r.source, 'saved');
});

test('wallet transfer bonus fills in when the pair has no saved rate', () => {
    const r = rateForPair(null, 'pontos', 'avios', 80);
    assert.equal(r.from, 2);
    assert.equal(r.to, 1);
    assert.equal(r.bonusPercent, 80);
    assert.equal(r.source, 'wallet');
});

test('saved pair rate still wins over the wallet bonus', () => {
    const r = rateForPair({ conversionFrom: 2, conversionTo: 1, bonusPercent: 40 }, 'pontos', 'avios', 80);
    assert.equal(r.bonusPercent, 40);
    assert.equal(r.source, 'saved');
});

test('unit labels', () => {
    assert.equal(unitLabel('avios', 1), 'avio');
    assert.equal(unitLabel('avios', 2), 'avios');
    assert.equal(unitLabel('pontos', 2), 'pontos');
});
