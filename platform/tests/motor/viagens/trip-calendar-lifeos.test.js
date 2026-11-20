import test from 'node:test';
import assert from 'node:assert/strict';

const MONTH_LENGTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isLeapYear(year) {
    return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInMonthLifeOS(year, month) {
    if (month === 1) return isLeapYear(year) ? 29 : 28;
    return MONTH_LENGTH[month] ?? 30;
}

test('abril de 2027 tem 30 dias (não 29)', () => {
    assert.equal(daysInMonthLifeOS(2027, 3), 30);
});