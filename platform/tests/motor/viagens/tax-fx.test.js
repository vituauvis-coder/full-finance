import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_TAX_FX, effectiveTaxFxRate, taxesToBrl } from '../../../../motor/viagens/tax-fx.js';

test('BRL tax passes through unchanged', () => {
    assert.equal(taxesToBrl({ amount: 1800, currency: 'BRL' }), 1800);
});

test('EUR tax uses default FX when rate omitted', () => {
    assert.equal(taxesToBrl({ amount: 50, currency: 'EUR' }), 50 * DEFAULT_TAX_FX.EUR);
});

test('effectiveTaxFxRate prefers stored rate, then live quote', () => {
    assert.equal(effectiveTaxFxRate('EUR', null, { EUR: 6.348 }), 6.348);
    assert.equal(effectiveTaxFxRate('EUR', 6.1, { EUR: 6.348 }), 6.1);
});

test('foreign tax respects custom FX, IOF and spread', () => {
    const brl = taxesToBrl({
        amount: 100,
        currency: 'USD',
        fxRate: 5,
        iofPercent: 6.38,
        spreadPercent: 4
    });
    assert.equal(brl, 553.18);
});