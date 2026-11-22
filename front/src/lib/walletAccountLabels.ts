import type { Account } from './types/finance';

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
    conta_corrente: 'Conta corrente',
    poupanca: 'Poupança',
    investimento: 'Investimento',
    dinheiro: 'Dinheiro',
    outros: 'Outros',
    alimentacao: 'Vale alimentação',
    refeicao: 'Vale refeição',
    vale_alimentacao: 'Vale alimentação',
    vale_refeicao: 'Vale refeição',
    cartao_credito: 'Cartão de crédito',
    cartao_debito: 'Cartão de débito',
    cofrinho: 'Cofrinho'
};

export function accountTypeDisplayLabel(type?: string) {
    if (type && ACCOUNT_TYPE_LABELS[type]) return ACCOUNT_TYPE_LABELS[type];
    return String(type || 'Conta')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function accountHolderDisplayLabel(acc: Account & { holderUserName?: string; holderName?: string }) {
    const fromUser =
        acc.holderUserName != null && String(acc.holderUserName).trim() !== ''
            ? String(acc.holderUserName).trim()
            : '';
    const fromLegacy =
        acc.holderName != null && String(acc.holderName).trim() !== '' ? String(acc.holderName).trim() : '';
    return fromUser || fromLegacy;
}

export function isBenefitWalletInstitution(type?: string) {
    return type === 'alimentacao' || type === 'refeicao';
}

const WALLET_INSTITUTION_TYPES = new Set([
    'conta_corrente',
    'investimento',
    'alimentacao',
    'refeicao',
    'poupanca',
    'outros',
    'dinheiro'
]);

export function isWalletInstitutionAccount(account: Account) {
    const t = String(account.type ?? '');
    return WALLET_INSTITUTION_TYPES.has(t);
}