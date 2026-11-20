import test from 'node:test';
import assert from 'node:assert/strict';
import {
    buildFinanceExpenseDraft,
    FINANCE_TRIP_CATEGORY,
    tripExpenseSubcategory
} from '../../../../motor/viagens/trip-finance-fields.js';

test('buildFinanceExpenseDraft ignora Pix', () => {
    assert.equal(
        buildFinanceExpenseDraft({ id: 'e1', amount: 100, paymentMethod: 'pix' }, 'trip-1'),
        null
    );
});

test('buildFinanceExpenseDraft exige conta e valor no cartão', () => {
    assert.equal(
        buildFinanceExpenseDraft(
            { id: 'e1', amount: 0, paymentMethod: 'credit_card', accountId: 'acc' },
            'trip-1'
        ),
        null
    );
    assert.equal(
        buildFinanceExpenseDraft(
            { id: 'e1', amount: 50, paymentMethod: 'credit_card' },
            'trip-1'
        ),
        null
    );
});

test('buildFinanceExpenseDraft mapeia categoria Viagens e subcategoria', () => {
    const draft = buildFinanceExpenseDraft(
        {
            id: 'e1',
            amount: 1200,
            paymentMethod: 'credit_card',
            accountId: 'card-1',
            category: 'transporte',
            description: 'Passagem',
            spentOn: '2026-03-10',
            installments: 3
        },
        'trip-abc'
    );
    assert.ok(draft);
    assert.equal(draft.category, FINANCE_TRIP_CATEGORY);
    assert.equal(draft.subcategory, tripExpenseSubcategory({ category: 'transporte' }));
    assert.equal(draft.subcategory, 'Voos');
    assert.equal(draft.amount, 1200);
    assert.equal(draft.installmentCount, 3);
    assert.equal(draft.tripId, 'trip-abc');
    assert.equal(draft.tripExpenseId, 'e1');
    assert.equal(draft.isPaid, false);
});