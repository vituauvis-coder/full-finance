import test from 'node:test';
import assert from 'node:assert/strict';
import {
    buildExpenseInstallmentCellView,
    buildExpenseInstallmentCompactHoverHtml
} from '../../../motor/dinheiro/expense-installment-cell-view.js';

test('recorte histórico: 3x no mês da 1ª mostra 2 restantes mesmo se a 1ª já foi paga depois', () => {
    const view = buildExpenseInstallmentCellView({
        total: 3,
        paidCount: 3,
        remaining: 0,
        allPaid: true,
        monthParcel: { index: 1, total: 3, paid: true, scope: 'period' }
    });
    assert.equal(view.label, '2 restantes');
    assert.equal(view.tone, 'open');
    assert.equal(view.ahead, 2);
    assert.equal(view.monthPaid, false);
});

test('recorte histórico: mês do meio de 10x mostra 7 restantes', () => {
    const view = buildExpenseInstallmentCellView({
        total: 10,
        paidCount: 10,
        remaining: 0,
        allPaid: true,
        monthParcel: { index: 3, total: 10, paid: true, scope: 'period' }
    });
    assert.equal(view.label, '7 restantes');
    assert.equal(view.tone, 'open');
});

test('só a última parcela paga mostra Quitada', () => {
    const view = buildExpenseInstallmentCellView({
        total: 3,
        paidCount: 3,
        remaining: 0,
        allPaid: true,
        monthParcel: { index: 3, total: 3, paid: true, scope: 'period' }
    });
    assert.equal(view.label, 'Quitada');
    assert.equal(view.tone, 'settled');
    assert.equal(view.monthPaid, true);
});

test('última parcela ainda em aberto: 1 restante', () => {
    const view = buildExpenseInstallmentCellView({
        total: 3,
        paidCount: 2,
        remaining: 1,
        allPaid: false,
        monthParcel: { index: 3, total: 3, paid: false, scope: 'period' }
    });
    assert.equal(view.label, '1 restante');
    assert.equal(view.tone, 'open');
});

test('hover compacto: só fração e valor, sem restantes', () => {
    const view = buildExpenseInstallmentCellView({
        total: 3,
        paidCount: 3,
        remaining: 0,
        allPaid: true,
        monthParcel: { index: 1, total: 3, paid: true, scope: 'period' }
    });
    const html = buildExpenseInstallmentCompactHoverHtml(view, { perAmount: 50, currency: 'BRL' });
    assert.match(html, /1\/3/);
    assert.match(html, /50/);
    assert.doesNotMatch(html, /restante/);
    assert.doesNotMatch(html, /Quitada/);
});
