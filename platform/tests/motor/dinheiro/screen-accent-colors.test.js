import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    DEFAULT_SCREEN_ACCENTS,
    LEGACY_PORTAL_SCREEN_ACCENTS,
    SCREEN_ACCENT_PRESET_CHARTS,
    SCREEN_ACCENT_PRESET_CLASSIC,
    SCREEN_ACCENT_PRESET_PORTAL,
    SCREEN_ACCENT_KEYS,
    SCREEN_ACCENT_QUICK_PICKS,
    SCREEN_ACCENT_THEME_PRESETS,
    buildScreenAccentCssProperties,
    getScreenAccentOverrides,
    getScreenAccentPreferences,
    normalizeHexColor,
    sanitizeScreenAccentPatch
} from '../../../../motor/dinheiro/screen-accent-colors.js';
import { mergeFinancePreferences } from '../../../../motor/dinheiro/finance-preferences.js';

test('normalizeHexColor expands shorthand', () => {
    assert.equal(normalizeHexColor('#abc'), '#aabbcc');
});

test('getScreenAccentPreferences merges overrides', () => {
    const prefs = getScreenAccentPreferences({
        financePreferences: { screenAccents: { expenses: '#112233' } }
    });
    assert.equal(prefs.expenses, '#112233');
    assert.equal(prefs.gains, DEFAULT_SCREEN_ACCENTS.gains);
});

test('getScreenAccentOverrides drops defaults', () => {
    const o = getScreenAccentOverrides({
        financePreferences: { screenAccents: { gains: DEFAULT_SCREEN_ACCENTS.gains, expenses: '#aabbcc' } }
    });
    assert.deepEqual(o, { expenses: '#aabbcc' });
});

test('buildScreenAccentCssProperties sets base and derived tokens', () => {
    const props = buildScreenAccentCssProperties({ expenses: '#ff0000' });
    assert.equal(props['--expenses-accent'], '#ff0000');
    assert.match(props['--expenses-accent-strong'], /^#[0-9a-f]{6}$/);
    assert.match(props['--expenses-accent-soft'], /^#[0-9a-f]{6}$/);
});

test('buildScreenAccentCssProperties uses legacy portal derivatives for coral expenses', () => {
    const props = buildScreenAccentCssProperties({ expenses: '#ff5a36' });
    assert.equal(props['--expenses-accent-strong'], '#e04a28');
    assert.equal(props['--expenses-accent-soft'], '#ffb8a6');
});

test('mergeFinancePreferences keeps other screen accent keys', () => {
    const merged = mergeFinancePreferences(
        { screenAccents: { gains: '#aabbcc' } },
        { screenAccents: { expenses: '#112233' } }
    );
    assert.deepEqual(merged.screenAccents, { gains: '#aabbcc', expenses: '#112233' });
});

test('sanitizeScreenAccentPatch omits default colors', () => {
    assert.deepEqual(
        sanitizeScreenAccentPatch({ gains: DEFAULT_SCREEN_ACCENTS.gains, expenses: '#aabbcc' }),
        { expenses: '#aabbcc' }
    );
});

test('quick picks expose five thematic swatches per screen', () => {
    for (const key of SCREEN_ACCENT_KEYS) {
        assert.equal(SCREEN_ACCENT_QUICK_PICKS[key].length, 5, key);
        for (const swatch of SCREEN_ACCENT_QUICK_PICKS[key]) {
            assert.match(swatch.hex, /^#[0-9a-f]{6}$/);
            assert.ok(swatch.label.length > 0);
        }
    }
});

test('theme presets match legacy portal and classic red expenses', () => {
    assert.equal(SCREEN_ACCENT_THEME_PRESETS.length, 4);
    assert.deepEqual(SCREEN_ACCENT_PRESET_PORTAL.accents, LEGACY_PORTAL_SCREEN_ACCENTS);
    assert.equal(SCREEN_ACCENT_PRESET_CLASSIC.accents.gains, '#10b981');
    assert.equal(SCREEN_ACCENT_PRESET_CLASSIC.accents.expenses, '#ef4444');
    assert.equal(SCREEN_ACCENT_PRESET_CLASSIC.accents.wallet, '#2563eb');
    assert.equal(SCREEN_ACCENT_PRESET_CHARTS.accents.gains, '#22c55e');
    assert.equal(SCREEN_ACCENT_PRESET_CHARTS.accents.expenses, '#ef4444');
    assert.equal(SCREEN_ACCENT_PRESET_CHARTS.accents.wallet, '#2563eb');
});