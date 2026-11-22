/**
 * Conta-mãe (corrente) + plásticos vinculados = uma instituição com várias funções.
 * Os `wallet_functions` da instituição refletem corrente + crédito/débito/VA ligados.
 */

const INSTITUTION_TYPES = new Set([
    'conta_corrente',
    'poupanca',
    'investimento',
    'dinheiro',
    'outros',
    'alimentacao',
    'refeicao',
    'cofrinho'
]);

const KIND_BY_PLASTIC_TYPE = new Map([
    ['cartao_credito', 'credit'],
    ['cartao_debito', 'debit'],
    ['vale_alimentacao', 'food'],
    ['vale_refeicao', 'meal']
]);

const KIND_BY_INSTITUTION_TYPE = new Map([
    ['conta_corrente', 'bank'],
    ['poupanca', 'savings'],
    ['investimento', 'investment'],
    ['cofrinho', 'cofrinho'],
    ['alimentacao', 'food'],
    ['refeicao', 'meal'],
    ['dinheiro', 'bank'],
    ['outros', 'bank']
]);

function isInstitutionAccount(type) {
    return INSTITUTION_TYPES.has(String(type ?? ''));
}

function linkedInstitutionId(account) {
    return String(account?.linkedAccountId ?? account?.linked_account_id ?? '').trim();
}

function parseWalletFunctions(account) {
    const raw = account?.walletFunctions ?? account?.wallet_functions;
    if (!Array.isArray(raw)) return [];
    return raw.map((k) => String(k ?? '').trim()).filter(Boolean);
}

function kindForPlastic(account) {
    const t = String(account?.type ?? '');
    const base = KIND_BY_PLASTIC_TYPE.get(t);
    if (base) return base;
    if (t === 'cartao_credito' && !account?.linkedAccountId) return 'store';
    return null;
}

function kindForInstitutionType(type) {
    const t = String(type ?? '');
    if (t === 'alimentacao') return ['food', 'meal'];
    if (t === 'refeicao') return ['meal'];
    return [KIND_BY_INSTITUTION_TYPE.get(t) || 'bank'];
}

/**
 * @param {object[]} accounts
 * @returns {object[]}
 */
export function enrichInstitutionWalletFunctions(accounts) {
    const list = Array.isArray(accounts) ? accounts.map((a) => ({ ...a })) : [];
    const byId = new Map(list.map((a) => [String(a.id), a]));

    for (const inst of list) {
        if (!isInstitutionAccount(inst.type)) continue;
        const kinds = new Set(parseWalletFunctions(inst));
        for (const k of kindForInstitutionType(inst.type)) kinds.add(k);

        for (const plastic of list) {
            const link = linkedInstitutionId(plastic);
            if (!link || link !== String(inst.id)) continue;
            const pk = kindForPlastic(plastic);
            if (pk) kinds.add(pk);
        }

        inst.walletFunctions = [...kinds];
    }

    return list;
}

/** Conta de caixa para saldo: instituição vinculada ao plástico, nunca o cartão isolado. */
export function resolveInstitutionForCashBalance(account, accounts) {
    const all = accounts || [];
    const acc = account ?? {};
    const t = String(acc.type ?? '');
    if (isInstitutionAccount(t)) return acc;
    const link = linkedInstitutionId(acc);
    if (!link) return null;
    const inst = all.find((a) => String(a.id) === link);
    if (inst && isInstitutionAccount(inst.type)) return inst;
    return null;
}

/** Nunca usar cartão de crédito/débito como conta de saldo — sempre a instituição mãe. */
export function cashBalanceAccountForDisplay(focusAccount, accounts) {
    return resolveInstitutionForCashBalance(focusAccount, accounts) ?? focusAccount;
}