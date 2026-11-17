import test from 'node:test';
import assert from 'node:assert/strict';
import {
    buildFinancePreferencesWithUiChips,
    getUiChipsFromProfile,
    normalizeUiChips
} from '../../../../motor/dinheiro/ui-chip-preferences.js';

test('normalizeUiChips defaults', () => {
    const chips = normalizeUiChips(null);
    assert.equal(chips.gainsList.paid, false);
    assert.deepEqual(chips.dashboard.gains, []);
});

test('getUiChipsFromProfile reads nested json', () => {
    const profile = {
        financePreferences: {
            manualCashOut: { enabled: true, creditCard: true, loan: true, monthlyFixed: false },
            uiChips: {
                gainsList: { paid: true, unpaid: false },
                dashboard: { gains: ['paid'], expenses: ['pix', 'paid'] }
            }
        }
    };
    const chips = getUiChipsFromProfile(profile);
    assert.equal(chips.gainsList.paid, true);
    assert.deepEqual([...chips.dashboard.expenses].sort(), ['paid', 'pix']);
});

test('buildFinancePreferencesWithUiChips keeps manualCashOut', () => {
    const profile = {
        financePreferences: {
            manualCashOut: { enabled: false, creditCard: true, loan: false, monthlyFixed: true }
        }
    };
    const body = buildFinancePreferencesWithUiChips(profile, normalizeUiChips({ gainsList: { paid: true, unpaid: true } }));
    assert.equal(body.manualCashOut.loan, false);
    assert.equal(body.uiChips.gainsList.paid, true);
});