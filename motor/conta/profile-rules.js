/** Regras de perfil / conta (sem UI, fetch ou storage). */

export const PROFILE_PHOTO_MAX_BYTES = 2 * 1024 * 1024;

export const PROFILE_PASSWORD_MIN_LENGTH = 6;

export const PROFILE_CURRENCIES = [
    { value: 'BRL', label: 'Real brasileiro (R$)', symbol: 'R$' },
    { value: 'USD', label: 'Dólar americano ($)', symbol: '$' },
    { value: 'EUR', label: 'Euro (€)', symbol: '€' }
];

/** @param {{ type?: string, size?: number }} file */
export function validateProfilePhotoFile(file) {
    const type = String(file?.type ?? '');
    const size = Number(file?.size ?? 0);
    if (!type.startsWith('image/')) {
        return { ok: false, code: 'INVALID_TYPE' };
    }
    if (size > PROFILE_PHOTO_MAX_BYTES) {
        return { ok: false, code: 'TOO_LARGE' };
    }
    return { ok: true };
}

/** @param {string} code */
export function profilePhotoErrorMessage(code) {
    switch (code) {
        case 'INVALID_TYPE':
            return 'Selecione uma imagem válida (JPG, PNG, GIF…).';
        case 'TOO_LARGE':
            return 'Imagem muito grande. Tamanho máximo: 2 MB.';
        default:
            return 'Não foi possível processar a imagem.';
    }
}

/** @param {{ next?: string, confirm?: string }} fields */
export function validatePasswordChange(fields) {
    const next = String(fields?.next ?? '');
    const confirm = String(fields?.confirm ?? '');
    if (next !== confirm) {
        return { ok: false, message: 'As senhas não coincidem.' };
    }
    if (next.length < PROFILE_PASSWORD_MIN_LENGTH) {
        return { ok: false, message: 'Use pelo menos 6 caracteres.' };
    }
    return { ok: true };
}

/** @param {string} code */
export function profileCurrencyLabel(code) {
    const row = PROFILE_CURRENCIES.find((c) => c.value === code);
    return row ? row.label : code;
}

/** @param {string} code */
export function profileCurrencySymbol(code) {
    const row = PROFILE_CURRENCIES.find((c) => c.value === code);
    return row ? row.symbol : code;
}

/** @param {unknown} amount */
export function formatBalanceInputValue(amount) {
    const n = Number(amount);
    if (!Number.isFinite(n)) return '0.00';
    return n.toFixed(2);
}

/** @param {string} raw */
export function parseBalanceSubmit(raw) {
    const balance = parseFloat(String(raw));
    if (!Number.isFinite(balance)) {
        return { ok: false };
    }
    return { ok: true, balance };
}

/** @param {'light' | 'dark'} mode */
export function profileThemeLabel(mode) {
    return mode === 'dark' ? 'Escuro' : 'Claro';
}