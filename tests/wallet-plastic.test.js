import assert from 'node:assert/strict';
import test from 'node:test';
import {
    buildWalletPlasticHtml,
    buildWalletPlasticsColumnHtml,
    buildWalletAccountCardsHtml
} from '../js/features/finance/wallet-plastic.js';

test('crédito inclui valor, vencimento e data-card-id', () => {
    const html = buildWalletPlasticHtml({
        id: 'card-1',
        name: 'Bradesco Gold',
        slot: 'credit',
        walletMode: 'bank',
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
        slot: 'debit',
        walletMode: 'bank',
        dueText: '',
        amountText: 'R$ 999,00',
        themeClass: ''
    });
    assert.match(html, /data-card-id="deb-1"/);
    assert.match(html, /wallet-plastic--debit/);
    assert.match(html, /Sem fatura/);
    assert.doesNotMatch(html, /R\$ 999,00/);
});

test('benefício usa slots Alimentação e Refeição com atalhos food/meal', () => {
    const html = buildWalletAccountCardsHtml({
        bankId: 'alelo-1',
        walletMode: 'benefit',
        institutionColors: { credit: '#0d8f4c', debit: '#0a7040' },
        slot1Plastics: [],
        slot2Plastics: []
    });
    assert.match(html, /Alimentação/);
    assert.match(html, /Refeição/);
    assert.doesNotMatch(html, /wallet-plastic__kind">Crédito/);
    assert.doesNotMatch(html, /wallet-plastic__kind">Débito/);
    assert.match(html, /data-wallet-link-food="alelo-1"/);
    assert.match(html, /data-wallet-link-meal="alelo-1"/);
    assert.match(html, /wallet-plastic--placeholder/);
    assert.doesNotMatch(html, /style="/);
    assert.match(html, /wallet-plastic--food/);
    assert.match(html, /wallet-plastic--meal/);
});

test('conta bancária sem cartões mostra crédito + débito com atalhos', () => {
    const html = buildWalletAccountCardsHtml({
        bankId: 'bank-9',
        walletMode: 'bank',
        themeClass: '',
        slot1Plastics: [],
        slot2Plastics: []
    });
    assert.match(html, /data-wallet-link-credit="bank-9"/);
    assert.match(html, /data-wallet-link-debit="bank-9"/);
    assert.match(html, /wallet-plastic--placeholder/);
    assert.equal((html.match(/wallet-plastic--credit/g) || []).length, 1);
    assert.equal((html.match(/wallet-plastic--debit/g) || []).length, 1);
});

test('buildWalletPlasticsColumnHtml reparte crédito e débito', () => {
    const html = buildWalletPlasticsColumnHtml(
        [
            { id: 'c1', name: 'Crédito', slot: 'credit', dueText: '', amountText: 'R$ 1,00', themeClass: '' },
            { id: 'd1', name: 'Débito', slot: 'debit', dueText: '', amountText: '', themeClass: '' }
        ],
        'bank-9'
    );
    assert.match(html, /data-card-id="c1"/);
    assert.match(html, /data-card-id="d1"/);
    assert.doesNotMatch(html, /data-wallet-link-credit/);
});

test('escapa nome do cartão', () => {
    const html = buildWalletPlasticHtml({
        id: 'x',
        name: '<img>',
        slot: 'credit',
        walletMode: 'bank',
        dueText: '',
        amountText: 'R$ 0,00',
        themeClass: ''
    });
    assert.match(html, /&lt;img&gt;/);
    assert.doesNotMatch(html, /<img>/);
});
