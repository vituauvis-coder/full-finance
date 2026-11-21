import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareExpenseRowsForTreemap } from '../../../../motor/dinheiro/expense-treemap.js';

test('treemap Saídas: referenceOnly (pré-âncora) entra no mapa — alinhado aos cards/lista', () => {
    const rows = [
        {
            id: 'e-ref',
            amount: 190,
            category: 'Compras',
            date: '2026-01-05',
            accountId: 'c1',
            referenceOnly: true
        }
    ];
    const prepared = prepareExpenseRowsForTreemap(rows, [
        { id: 'c1', type: 'cartao_credito', closeDay: 4, dueDay: 10 }
    ]);
    assert.equal(prepared.length, 1);
    assert.equal(prepared[0].id, 'e-ref');
    assert.equal(prepared[0].amount, 190);
});

test('treemap Saídas: cartão parcelado usa valor da parcela, não o total da compra', () => {
    const rows = [
        {
            id: 'e-watch',
            amount: 2280,
            installmentCount: 12,
            category: 'Eletrônicos',
            date: '2025-12-10',
            accountId: 'c1',
            referenceOnly: true
        }
    ];
    const prepared = prepareExpenseRowsForTreemap(rows, [
        { id: 'c1', type: 'cartao_credito', closeDay: 1, dueDay: 10 }
    ]);
    assert.equal(prepared.length, 1);
    assert.equal(prepared[0].amount, 190);
});

test('treemap Saídas: amount zero ou inválido não entra', () => {
    const prepared = prepareExpenseRowsForTreemap(
        [
            { id: 'z', amount: 0, category: 'X' },
            { id: 'n', amount: -10, category: 'Y' }
        ],
        []
    );
    assert.equal(prepared.length, 0);
});
