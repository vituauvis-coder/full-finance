import test from 'node:test';
import assert from 'node:assert/strict';
import { daysUntilDayKey, atlasHomeCountdownItems } from '../../../../motor/viagens/atlas-home-countdown.js';

test('daysUntilDayKey conta dias até a data', () => {
    const now = new Date('2026-06-15T12:00:00-03:00');
    assert.equal(daysUntilDayKey('2026-06-20', now), 5);
    assert.equal(daysUntilDayKey('2026-06-15', now), 0);
});

test('atlasHomeCountdownItems ignora realizadas e ordena por proximidade', () => {
    const now = new Date('2026-06-15T12:00:00-03:00');
    const items = atlasHomeCountdownItems(
        [
            { id: 'a', title: 'Antiga', startsOn: '2025-01-01', endsOn: '2025-01-10' },
            { id: 'b', title: 'Logo', startsOn: '2026-06-20', endsOn: '2026-06-25' },
            { id: 'c', title: 'Andamento', startsOn: '2026-06-10', endsOn: '2026-06-18' }
        ],
        now
    );
    assert.equal(items.length, 2);
    assert.equal(items[0].tripId, 'c');
    assert.equal(items[0].mode, 'until_end');
    assert.equal(items[0].daysRemaining, 3);
    assert.equal(items[1].tripId, 'b');
    assert.equal(items[1].daysRemaining, 5);
});