import test from 'node:test';
import assert from 'node:assert/strict';
import {
    calendarDayKeyFromDate,
    monthKeyFromDate,
    normalizePaidPeriodKeysToDues
} from '../../../../motor/dinheiro/cash-out-periods.js';

test('normalize: mantém dia canónico', () => {
    const dues = [new Date(2026, 10, 10), new Date(2027, 3, 10)];
    const keys = [calendarDayKeyFromDate(dues[0]), calendarDayKeyFromDate(dues[1])];
    assert.deepEqual(normalizePaidPeriodKeysToDues(keys, dues), keys);
});

test('normalize: YYYY-MM antecipado mapeia para o vencimento do mês', () => {
    const dues = [
        new Date(2026, 10, 10),
        new Date(2026, 11, 10),
        new Date(2027, 0, 10),
        new Date(2027, 1, 10),
        new Date(2027, 2, 10),
        new Date(2027, 3, 10)
    ];
    const nov = calendarDayKeyFromDate(dues[0]);
    const abrMonth = monthKeyFromDate(dues[5]);
    const abrDay = calendarDayKeyFromDate(dues[5]);
    const out = normalizePaidPeriodKeysToDues([nov, abrMonth], dues);
    assert.deepEqual(out.sort(), [nov, abrDay].sort());
});

test('normalize: dia diferente no mesmo mês mapeia para o vencimento', () => {
    const dues = [new Date(2027, 3, 10)];
    const out = normalizePaidPeriodKeysToDues(['2027-04-01'], dues);
    assert.deepEqual(out, [calendarDayKeyFromDate(dues[0])]);
});

test('normalize: chave de mês fora do cronograma some', () => {
    const dues = [new Date(2026, 10, 10)];
    assert.deepEqual(normalizePaidPeriodKeysToDues(['2027-04'], dues), []);
});
