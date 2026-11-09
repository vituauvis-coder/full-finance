import assert from 'node:assert/strict';
import test from 'node:test';
import { buildWalletPlasticHtml, buildWalletPlasticsColumnHtml } from '../js/features/finance/wallet-plastic.js';

test('crédito inclui valor, vencimento e data-card-id', () => {
    const html = buildWalletPlasticHtml({
        id: 'card-1',
        name: 'Bradesco Gold',
        kind: 'credit',
        dueText: 'Vence dia 10',
        amountText: 'R$ 1.100,00',
        themeClass: 'account-card--bank-bradesco'
    });
    assert.match(html, /data-card-id="card-1"/);
    assert.match(html, /wallet-card-open/);
    assert.match(html, /wallet-plastic--credit/);
    assert.match(html, /account-card--bank-bradesco/);
    assert.match(html, /Vence dia 10/);
    assert.match(html, /R\$ 1\.100,00/);
    assert.doesNotMatch(html, /Sem fatura/);
});

test('débito mostra Sem fatura e não mostra valor', () => {
    const html = buildWalletPlasticHtml({
        id: 'deb-1',
        name: 'Bradesco Débito',
        kind: 'debit',
        dueText: '',
        amountText: 'R$ 999,00',
        themeClass: ''
    });
    assert.match(html, /data-card-id="deb-1"/);
    assert.match(html, /wallet-plastic--debit/);
    assert.match(html, /Sem fatura/);
    assert.doesNotMatch(html, /R\$ 999,00/);
});

test('lista vazia oferece adicionar crédito na conta', () => {
    const html = buildWalletPlasticsColumnHtml([], 'bank-9');
    assert.match(html, /Sem cartão de crédito atrelado/);
    assert.match(html, /data-wallet-link-credit="bank-9"/);
    assert.doesNotMatch(html, /wallet-plastic/);
});

test('escapa nome do cartão', () => {
    const html = buildWalletPlasticHtml({
        id: 'x',
        name: '<img>',
        kind: 'credit',
        dueText: '',
        amountText: 'R$ 0,00',
        themeClass: ''
    });
    assert.match(html, /&lt;img&gt;/);
    assert.doesNotMatch(html, /<img>/);
});
