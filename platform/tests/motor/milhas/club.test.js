import test from 'node:test';
import assert from 'node:assert/strict';
import { clubCreditDates, clubInvested, clubMilheiro, missingClubCredits } from '../../../../motor/milhas/club.js';

test('first credit is the signup date, then the same day each month', () => {
    assert.deepEqual(clubCreditDates('2026-11-17', '2026-11-17'), ['2026-11-17']);
    assert.deepEqual(clubCreditDates('2026-09-17', '2026-11-17'), [
        '2026-09-17',
        '2026-10-17',
        '2026-11-17'
    ]);
});

test('end-of-month signup clamps to February', () => {
    assert.deepEqual(clubCreditDates('2026-01-31', '2026-03-01'), ['2026-01-31', '2026-02-28']);
});

test('future anniversary this month is not due yet', () => {
    assert.deepEqual(clubCreditDates('2026-11-20', '2026-11-17'), []);
});

test('missing credits skip months already posted and ignore zero points', () => {
    assert.deepEqual(
        missingClubCredits({
            startedOn: '2026-09-17',
            today: '2026-11-17',
            existingOn: ['2026-09-17'],
            points: 10000,
            feeBrl: 49
        }),
        [
            {
                occurredOn: '2026-10-17',
                points: 10000,
                amountBrl: '49',
                notes: 'Clube 10/2026'
            },
            {
                occurredOn: '2026-11-17',
                points: 10000,
                amountBrl: '49',
                notes: 'Clube 11/2026'
            }
        ]
    );
    assert.deepEqual(
        missingClubCredits({
            startedOn: '2026-01-01',
            today: '2026-11-17',
            points: 0
        }),
        []
    );
});

test('club bonus counts only on the first monthly credit', () => {
    assert.deepEqual(
        missingClubCredits({
            startedOn: '2026-11-17',
            today: '2026-11-17',
            existingOn: [],
            program: { clubPointsPerMonth: 0, clubBonusPerMonth: 25000 },
            feeBrl: 49
        }),
        [
            {
                occurredOn: '2026-11-17',
                points: 25000,
                amountBrl: '49',
                notes: 'Clube 11/2026'
            }
        ]
    );
    assert.deepEqual(
        missingClubCredits({
            startedOn: '2026-10-17',
            today: '2026-11-17',
            existingOn: ['2026-10-17'],
            program: { clubPointsPerMonth: 25000, clubBonusPerMonth: 25000 },
            feeBrl: 49
        }),
        [
            {
                occurredOn: '2026-11-17',
                points: 25000,
                amountBrl: '49',
                notes: 'Clube 11/2026'
            }
        ]
    );
});

test('club values current points from the monthly fee', () => {
    const club = { clubActive: true, clubFeeBrl: 800, clubPointsPerMonth: 25000 };
    assert.equal(clubMilheiro(club, 25000), 32);
    assert.equal(clubInvested(club, 25000), 800);
    assert.equal(clubInvested({ ...club, clubPointsPerMonth: 0 }, 25000), 800);
    assert.equal(clubInvested({ ...club, clubPointsPerMonth: 25000 }, 50000), 1600);
    assert.equal(clubInvested({ clubActive: true, clubFeeBrl: 800, clubPointsPerMonth: 20000, clubBonusPerMonth: 5000 }, 25000), 800);
    assert.equal(clubInvested({ ...club, clubPointsPerMonth: 25000 }, 25002), 800);
    assert.equal(clubInvested({ ...club, clubPointsPerMonth: 25000 }, 50002), 1600);
    assert.equal(clubInvested({ ...club, clubPointsPerMonth: 25000 }, 15000), 480);
    assert.equal(clubInvested({ ...club, clubActive: false }, 25000), 0);
});
