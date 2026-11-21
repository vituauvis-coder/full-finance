import assert from 'node:assert/strict';
import test from 'node:test';
import {
    tripFeedCountdown,
    tripDiaryDailyBudget,
    tripDiaryDayKeys,
    tripFeedClockZones,
    convertLocalHmToZone,
    convertLocalHmToZoneDetail,
    TRIP_DIARY_DAILY_CATEGORIES
} from '../../../../motor/viagens/trip-diary-feed.js';

test('tripDiaryDayKeys gera intervalo inclusive', () => {
    const keys = tripDiaryDayKeys('2026-03-01', '2026-03-03');
    assert.deepEqual(keys, ['2026-03-01', '2026-03-02', '2026-03-03']);
});

test('tripFeedCountdown antes da viagem', () => {
    const now = new Date('2026-02-01T15:00:00-03:00');
    const snap = tripFeedCountdown({
        startsOn: '2026-03-01',
        endsOn: '2026-03-10',
        statusOverride: null,
        now
    });
    assert.equal(snap.mode, 'until_start');
    assert.equal(snap.days, 28);
});

test('tripDiaryDailyBudget reparte saldo nos dias restantes', () => {
    const trip = {
        budgetCaps: { comida: 1000, transporte: 500, passeios: 500, extras: 0, hospedagem: 9000 },
        payload: { expenses: [{ amount: 200, category: 'comida' }] }
    };
    const now = new Date('2026-03-02T12:00:00-03:00');
    const row = tripDiaryDailyBudget({
        trip,
        onDayKey: '2026-03-02',
        startsOn: '2026-03-01',
        endsOn: '2026-03-05',
        now
    });
    assert.equal(TRIP_DIARY_DAILY_CATEGORIES.includes('hospedagem'), false);
    assert.ok(row.amount != null && row.amount > 0);
    assert.ok(row.formatted?.includes('R$'));
});

test('tripFeedClockZones inclui Recife e destinos únicos', () => {
    const zones = tripFeedClockZones(['China', 'Espanha', 'China', 'Brasil']);
    assert.ok(zones.some((z) => z.label === 'Recife'));
    assert.equal(zones.filter((z) => z.label === 'China').length, 1);
    assert.ok(zones.some((z) => z.label === 'Madri'));
    assert.ok(zones.length <= 3);
    assert.ok(!zones.some((z) => /brasil/i.test(z.label)));
});

test('tripFeedClockZones resolve Madri pelo nome da cidade', () => {
    const zones = tripFeedClockZones([
        { label: 'Madri', country: '' },
        { label: 'Xangai', country: 'China' }
    ]);
    assert.ok(zones.some((z) => z.label === 'Madri' && z.timeZone === 'Europe/Madrid'));
    assert.ok(zones.some((z) => /xangai/i.test(z.label) && z.timeZone === 'Asia/Shanghai'));
});

test('tripFeedClockZones não perde Madri com país España', () => {
    const zones = tripFeedClockZones([
        { label: 'Madrid', country: 'España' },
        { label: 'PEK', country: 'China' }
    ]);
    assert.ok(zones.some((z) => /madri/i.test(z.label) && z.timeZone === 'Europe/Madrid'));
    assert.ok(zones.some((z) => z.timeZone === 'Asia/Shanghai'));
});

test('convertLocalHmToZone Recife 17:00 → Madri', () => {
    assert.equal(
        convertLocalHmToZone('17:00', 'America/Recife', '2026-03-15', 'Europe/Madrid'),
        '21:00'
    );
});

test('convertLocalHmToZone Shanghai 05:00 → Recife', () => {
    assert.equal(
        convertLocalHmToZone('05:00', 'Asia/Shanghai', '2026-03-20', 'America/Recife'),
        '18:00'
    );
});

test('convertLocalHmToZoneDetail inclui data ao cruzar meia-noite', () => {
    const detail = convertLocalHmToZoneDetail(
        '18:00',
        'America/Recife',
        '2026-04-20',
        'Asia/Shanghai'
    );
    assert.ok(detail);
    assert.equal(detail.hm, '05:00');
    assert.equal(detail.dayKey, '2026-04-21');
    assert.match(detail.dateLabel, /21/);
});