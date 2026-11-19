import test from 'node:test';
import assert from 'node:assert/strict';
import { parseAwesomeApiQuotes } from '../../../../motor/viagens/fx-quotes.js';

test('parseAwesomeApiQuotes uses mid of bid and ask', () => {
    const { rates, asOf } = parseAwesomeApiQuotes({
        EURBRL: { bid: '6.34', ask: '6.36', create_date: '2026-11-17 22:00:00' },
        USDBRL: { bid: '5.77', ask: '5.79' }
    });
    assert.equal(rates.EUR, 6.35);
    assert.equal(rates.USD, 5.78);
    assert.equal(rates.BRL, 1);
    assert.equal(asOf, '2026-11-17 22:00:00');
});