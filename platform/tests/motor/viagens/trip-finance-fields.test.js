import test from 'node:test';
import assert from 'node:assert/strict';
import {
    buildFinanceExpenseDraft,
    FINANCE_TRIP_CATEGORY,
    financeTripSubcategory,
    tripExpenseSubcategory
} from '../../../../motor/viagens/trip-finance-fields.js';

test('financeTripSubcategory usa o nome da viagem', () => {
    assert.equal(financeTripSubcategory('China 2026'), 'China 2026');
    assert.equal(financeTripSubcategory('  '), 'Viagem');
    assert.equal(financeTripSubcategory(null), 'Viagem');
});

test('buildFinanceExpenseDraft exige conta e valor no Pix', () => {
    assert.equal(
        buildFinanceExpenseDraft({ id: 'e1', amount: 100, paymentMethod: 'pix' }, 'trip-1'),
        null
    );
    assert.equal(
        buildFinanceExpenseDraft(
            { id: 'e1', amount: 0, paymentMethod: 'pix', accountId: 'bank-1' },
            'trip-1'
        ),
        null
    );
});

test('buildFinanceExpenseDraft espelha Pix com categoria Viagens e subcategoria = nome da viagem', () => {
    const draft = buildFinanceExpenseDraft(
        {
            id: 'e-pass',
            amount: 257.77,
            paymentMethod: 'pix',
            accountId: 'bank-1',
            category: 'documentos',
            description: 'Passaporte',
            spentOn: '2026-11-10',
            paidFromCofrinho: false
        },
        'trip-abc',
        { tripTitle: 'China 2026' }
    );
    assert.ok(draft);
    assert.equal(draft.category, FINANCE_TRIP_CATEGORY);
    assert.equal(draft.subcategory, 'China 2026');
    assert.equal(draft.description, 'Passaporte');
    assert.equal(draft.amount, 257.77);
    assert.equal(draft.installmentCount, 1);
    assert.equal(draft.isPaid, true);
    assert.equal(draft.isCofrinho, false);
    assert.equal(draft.accountId, 'bank-1');
    assert.equal(draft.tripExpenseId, 'e-pass');
});

test('buildFinanceExpenseDraft Pix do cofrinho da viagem espelha tipo C', () => {
    const draft = buildFinanceExpenseDraft(
        {
            id: 'e2',
            amount: 50,
            paymentMethod: 'pix',
            accountId: 'bank-1',
            paidFromCofrinho: true,
            spentOn: '2026-11-01'
        },
        'trip-1',
        { tripTitle: 'Chile' }
    );
    assert.ok(draft);
    assert.equal(draft.category, FINANCE_TRIP_CATEGORY);
    assert.equal(draft.subcategory, 'Chile');
    assert.equal(draft.paidFromCofrinho, true);
    assert.equal(draft.isPaid, true);
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

test('buildFinanceExpenseDraft cartão usa nome da viagem como subcategoria', () => {
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
        'trip-abc',
        { tripTitle: 'Europa' }
    );
    assert.ok(draft);
    assert.equal(draft.category, FINANCE_TRIP_CATEGORY);
    assert.equal(draft.subcategory, 'Europa');
    assert.equal(tripExpenseSubcategory({ category: 'transporte' }), 'Transportes');
    assert.equal(draft.amount, 1200);
    assert.equal(draft.installmentCount, 3);
    assert.equal(draft.tripId, 'trip-abc');
    assert.equal(draft.tripExpenseId, 'e1');
    assert.equal(draft.isPaid, false);
});
