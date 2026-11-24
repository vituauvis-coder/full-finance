import assert from 'node:assert/strict';
import test from 'node:test';
import {
    cofrinhoGoalMonthsUntilDeadline,
    cofrinhoMonthlyPaceToGoal
} from '../../../../motor/dinheiro/cofrinho-goal-pace.js';

test('cofrinhoGoalMonthsUntilDeadline conta meses civis inclusive', () => {
    const now = new Date(2026, 10, 23, 12, 0, 0, 0);
    assert.equal(cofrinhoGoalMonthsUntilDeadline('2026-12-31', now), 2);
    assert.equal(cofrinhoGoalMonthsUntilDeadline('2027-01-15', now), 3);
});

test('cofrinhoMonthlyPaceToGoal divide o restante pelos meses', () => {
    const now = new Date(2026, 10, 23, 12, 0, 0, 0);
    const r = cofrinhoMonthlyPaceToGoal(15000, 5000, '2026-12-31', now);
    assert.ok(r);
    assert.equal(r.monthsLeft, 2);
    assert.equal(r.perMonth, 5000);
});