import assert from 'node:assert/strict';
import test from 'node:test';
import {
    formatBalanceInputValue,
    parseBalanceSubmit,
    profileCurrencyLabel,
    profilePhotoErrorMessage,
    validatePasswordChange,
    validateProfilePhotoFile
} from '../../../../motor/conta/profile-rules.js';

test('validateProfilePhotoFile', () => {
    assert.deepEqual(validateProfilePhotoFile({ type: 'image/png', size: 100 }), { ok: true });
    assert.equal(validateProfilePhotoFile({ type: 'text/plain', size: 100 }).code, 'INVALID_TYPE');
    assert.equal(validateProfilePhotoFile({ type: 'image/png', size: 9_000_000 }).code, 'TOO_LARGE');
});

test('validatePasswordChange', () => {
    assert.equal(validatePasswordChange({ next: 'abc', confirm: 'xyz' }).ok, false);
    assert.equal(validatePasswordChange({ next: '12', confirm: '12' }).ok, false);
    assert.equal(validatePasswordChange({ next: '123456', confirm: '123456' }).ok, true);
});

test('formatBalanceInputValue arredonda float ruidoso', () => {
    assert.equal(formatBalanceInputValue(1314.569999999999), '1314.57');
});

test('parseBalanceSubmit', () => {
    assert.deepEqual(parseBalanceSubmit('10.5'), { ok: true, balance: 10.5 });
    assert.equal(parseBalanceSubmit('x').ok, false);
});

test('profileCurrencyLabel', () => {
    assert.match(profileCurrencyLabel('BRL'), /Real brasileiro/);
});

test('profilePhotoErrorMessage', () => {
    assert.match(profilePhotoErrorMessage('TOO_LARGE'), /2 MB/);
});