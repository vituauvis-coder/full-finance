/**
 * Unicidade de contas na casa: uma instituição por titular; plásticos distinguíveis por vínculo.
 * Várias funções (crédito, VA, cofrinho…) ficam em `walletFunctions` na mesma conta, não duplicando linhas.
 */

/** Conta-mãe na carteira (corrente, VA instituição, cofrinho…). */
export const INSTITUTION_ACCOUNT_TYPES = new Set([
    'conta_corrente',
    'poupanca',
    'investimento',
    'dinheiro',
    'outros',
    'alimentacao',
    'refeicao',
    'cofrinho'
]);

export const PLASTIC_ACCOUNT_TYPES = new Set([
    'cartao_credito',
    'cartao_debito',
    'vale_alimentacao',
    'vale_refeicao'
]);

export function normalizeInstitutionKey(name) {
    return String(name ?? '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * @param {{ id?: string, name?: string, type?: string, holderUserId?: string, userId?: string, linkedAccountId?: string|null }} account
 * @returns {string|null}
 */
export function accountUniquenessKey(account) {
    const type = String(account?.type ?? '');
    const holder = String(account?.holderUserId ?? account?.userId ?? '').trim();
    const nameKey = normalizeInstitutionKey(account?.name);
    if (!holder || !nameKey) return null;

    if (INSTITUTION_ACCOUNT_TYPES.has(type)) {
        return `inst:${holder}:${nameKey}:${type}`;
    }
    if (PLASTIC_ACCOUNT_TYPES.has(type)) {
        const linked = String(account?.linkedAccountId ?? '').trim() || '_';
        return `plastic:${holder}:${nameKey}:${type}:${linked}`;
    }
    return null;
}

/**
 * @param {object[]} existingAccounts
 * @param {object} candidate
 * @param {string|null|undefined} excludeId
 * @returns {object|null} conta em conflito
 */
export function accountConflictsWithExisting(existingAccounts, candidate, excludeId = null) {
    const key = accountUniquenessKey(candidate);
    if (!key) return null;
    const skip = excludeId ? String(excludeId) : '';
    for (const acc of existingAccounts || []) {
        if (skip && String(acc.id) === skip) continue;
        if (accountUniquenessKey(acc) === key) return acc;
    }
    return null;
}

export function duplicateAccountErrorMessage(conflict, candidate) {
    const name = (conflict?.name || candidate?.name || 'Conta').trim();
    const shortId = String(conflict?.id ?? '').slice(0, 8);
    const idHint = shortId ? ` (id ${shortId})` : '';
    return (
        `Já existe «${name}» para este titular na mesma função${idHint}. ` +
        'Use Editar na conta existente e marque as funções no modal — não crie outra linha.'
    );
}