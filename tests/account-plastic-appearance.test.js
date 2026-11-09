import assert from 'node:assert/strict';
import test from 'node:test';
import {
    buildPlasticInlineStyle,
    canonicalPlasticPair,
    debitTintFromCredit,
    parseWalletPlasticColor,
    serializeWalletPlasticColor,
    textOnPlastic
} from '../js/features/finance/account-plastic-appearance.js';

test('serializa uma cor simples', () => {
    const raw = serializeWalletPlasticColor({ color: '#c2410c' });
    assert.ok(raw);
    assert.equal(JSON.parse(raw).color, '#c2410c');
    const legacy = serializeWalletPlasticColor({
        creditFrom: '#ec7000',
        creditTo: '#111827',
        debitFrom: '#1e293b'
    });
    assert.equal(JSON.parse(legacy).color, '#ec7000');
});

test('lê formato antigo e normaliza par crédito/débito', () => {
    const parsed = parseWalletPlasticColor(
        '{"creditFrom":"#ea580c","creditTo":"#111827","debitFrom":"#334155","debitTo":"#0f172a"}'
    );
    const pair = canonicalPlasticPair(parsed);
    assert.equal(pair.credit, '#ea580c');
    assert.equal(pair.debit, debitTintFromCredit('#ea580c'));
});

test('texto claro em fundos de marca (Neon) e escuro no amarelo BB', () => {
    assert.equal(textOnPlastic('#00d4e8'), '#f8fafc');
    assert.equal(textOnPlastic('#fff400'), '#0f172a');
});

test('cartão usa cor sólida sem gradiente', () => {
    const colors = canonicalPlasticPair({ color: '#820ad1' });
    const style = buildPlasticInlineStyle('credit', colors);
    assert.doesNotMatch(style, /gradient/);
    assert.match(style, /#820ad1/);
    const debitStyle = buildPlasticInlineStyle('debit', colors);
    assert.match(debitStyle, new RegExp(debitTintFromCredit('#820ad1')));
});
