import assert from 'node:assert/strict';
import test from 'node:test';
import {
    allCountryCatalog,
    canonicalCountryLabel,
    countriesCatalogSuggestions,
    countryIso2ForLabel,
    isCountryCatalogLabel
} from '../../../../motor/viagens/trip-countries.js';

test('canonicalCountryLabel keeps city names (Xangai ≠ China)', () => {
    assert.equal(canonicalCountryLabel('Xangai'), 'Xangai');
    assert.equal(canonicalCountryLabel('Shanghai'), 'Shanghai');
    assert.equal(canonicalCountryLabel('Madri'), 'Madri');
    assert.equal(canonicalCountryLabel('Paris'), 'Paris');
    assert.equal(canonicalCountryLabel('China'), 'China');
    assert.equal(canonicalCountryLabel('Espanha'), 'Espanha');
    assert.equal(canonicalCountryLabel('Spain'), 'Espanha');
});

test('countryIso2ForLabel still resolves cities to country', () => {
    assert.equal(countryIso2ForLabel('Xangai'), 'CN');
    assert.equal(countryIso2ForLabel('Madri'), 'ES');
    assert.equal(countryIso2ForLabel('Paris'), 'FR');
    assert.equal(countryIso2ForLabel('China'), 'CN');
});

test('isCountryCatalogLabel distinguishes country vs city', () => {
    assert.equal(isCountryCatalogLabel('China'), true);
    assert.equal(isCountryCatalogLabel('Espanha'), true);
    assert.equal(isCountryCatalogLabel('Xangai'), false);
    assert.equal(isCountryCatalogLabel('Madri'), false);
    assert.equal(isCountryCatalogLabel('Furong'), false);
});

test('allCountryCatalog includes full ISO list with pt-BR labels', () => {
    assert.ok(allCountryCatalog().length >= 190);
    assert.ok(allCountryCatalog().some((c) => c.label === 'Brasil'));
    assert.ok(allCountryCatalog().some((c) => c.label === 'Afeganistão' || c.iso2 === 'AF'));
});

test('countriesCatalogSuggestions lists all countries when query is empty', () => {
    const all = countriesCatalogSuggestions('', 8);
    assert.ok(all.length >= 190);
    assert.ok(all.includes('Brasil'));
});
