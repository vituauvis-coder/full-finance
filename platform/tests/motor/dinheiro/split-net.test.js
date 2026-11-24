import assert from 'node:assert/strict';
import test from 'node:test';
import {
    applySplitNetToContribution,
    expenseIdForSplitLookup,
    getNetExpenseTotalAmount,
    installmentSplitPeriodKeyMatches,
    normalizeSplitScope,
    sumAcceptedSettledFullSplitForExpense,
    sumAcceptedSettledInstallmentSplitForExpenseMonth
} from '../../../../motor/dinheiro/split-net.js';

test('normalizeSplitScope', () => {
    assert.equal(normalizeSplitScope('installment'), 'INSTALLMENT');
    assert.equal(normalizeSplitScope('FULL_EXPENSE'), 'FULL_EXPENSE');
    assert.equal(normalizeSplitScope(null), 'FULL_EXPENSE');
});

test('getNetExpenseTotalAmount desconta split FULL aceito', () => {
    const expense = { id: 'e1', amount: 200 };
    const splits = [
        { status: 'ACCEPTED', splitScope: 'FULL_EXPENSE', sourceExpenseId: 'e1', amount: 50 }
    ];
    assert.equal(getNetExpenseTotalAmount(expense, splits), 150);
    assert.equal(sumAcceptedSettledFullSplitForExpense('e1', splits), 50);
});

test('expenseIdForSplitLookup remove sufixo de parcela', () => {
    assert.equal(expenseIdForSplitLookup('esfera::inst-2026-12-07'), 'esfera');
});

test('splits com sourceExpenseId de linha de parcela contam na compra', () => {
    const expense = { id: 'esfera', amount: 800, installmentCount: 2 };
    const splits = [
        {
            status: 'ACCEPTED',
            splitScope: 'FULL_EXPENSE',
            sourceExpenseId: 'esfera',
            amount: 300
        },
        {
            status: 'ACCEPTED',
            splitScope: 'FULL_EXPENSE',
            sourceExpenseId: 'esfera::inst-2026-12-07',
            amount: 300
        }
    ];
    assert.equal(getNetExpenseTotalAmount(expense, splits), 200);
    assert.equal(
        applySplitNetToContribution(expense, '2026-12-07', 400, splits, null),
        100
    );
});

test('installmentSplitPeriodKeyMatches alinha mês civil com dia de vencimento', () => {
    assert.equal(installmentSplitPeriodKeyMatches('2026-12', '2026-12-07'), true);
    assert.equal(
        sumAcceptedSettledInstallmentSplitForExpenseMonth(
            'e1',
            '2026-12-07',
            [
                {
                    status: 'ACCEPTED',
                    splitScope: 'INSTALLMENT',
                    sourceExpenseId: 'e1',
                    targetPeriodKey: '2026-12',
                    amount: 80
                }
            ]
        ),
        80
    );
});