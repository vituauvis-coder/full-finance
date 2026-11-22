import { isBenefitCardType, isBankCardType } from '@legacy/js/core/utils.js';
import { isCreditCardType, isCardAccountType } from '../../../lib/accounts';
import { isBenefitWalletInstitution, isWalletInstitutionAccount } from '../../../lib/walletAccountLabels';
import type { Account } from '../../../lib/types/finance';

export type WalletAccountKind =
    | 'bank'
    | 'savings'
    | 'investment'
    | 'benefit_institution'
    | 'cofrinho'
    | 'credit'
    | 'debit'
    | 'store'
    | 'food'
    | 'meal';

export type WalletAccountRole = WalletAccountKind;

export type WalletAccountKindOption = {
    value: WalletAccountKind;
    label: string;
    shortLabel?: string;
    hint?: string;
    icon?: string;
};

export const WALLET_ACCOUNT_KIND_OPTIONS: WalletAccountKindOption[] = [
    { value: 'bank', label: 'Conta corrente', shortLabel: 'Corrente', icon: 'account_balance' },
    { value: 'savings', label: 'Poupança', shortLabel: 'Poupança', icon: 'savings' },
    { value: 'investment', label: 'Investimento', shortLabel: 'Investimento', icon: 'trending_up' },
    { value: 'cofrinho', label: 'Cofrinho / reserva', shortLabel: 'Cofrinho', icon: 'savings' },
    {
        value: 'benefit_institution',
        label: 'Benefício (legado)',
        shortLabel: 'Benefício',
        icon: 'lunch_dining'
    },
    {
        value: 'food',
        label: 'VA — Vale alimentação',
        shortLabel: 'VA',
        hint: 'Mercado, hortifruti, alimentação em geral',
        icon: 'shopping_basket'
    },
    {
        value: 'meal',
        label: 'VR — Vale refeição',
        shortLabel: 'VR',
        hint: 'Restaurantes, refeições prontas',
        icon: 'restaurant'
    },
    { value: 'credit', label: 'Cartão de crédito', shortLabel: 'Crédito', icon: 'credit_card' },
    { value: 'debit', label: 'Cartão de débito', shortLabel: 'Débito', icon: 'payment' },
    {
        value: 'store',
        label: 'Cartão de loja',
        shortLabel: 'Loja',
        hint: 'Bandeira fechada / crédito de loja',
        icon: 'storefront'
    }
];

export const WALLET_ACCOUNT_KIND_GROUPS: {
    id: 'accounts' | 'benefits' | 'cards';
    title: string;
    hint?: string;
    kinds: WalletAccountKind[];
}[] = [
    {
        id: 'accounts',
        title: 'Contas e reservas',
        kinds: ['bank', 'savings', 'investment', 'cofrinho']
    },
    {
        id: 'benefits',
        title: 'Vale alimentação e refeição',
        hint: 'Caju, Alelo, Swile… marque VA, VR ou os dois na mesma conta.',
        kinds: ['food', 'meal']
    },
    {
        id: 'cards',
        title: 'Cartões bancários',
        kinds: ['credit', 'debit', 'store']
    }
];

export const WALLET_KIND_OPTION_BY_VALUE = Object.fromEntries(
    WALLET_ACCOUNT_KIND_OPTIONS.map((o) => [o.value, o])
) as Record<WalletAccountKind, WalletAccountKindOption>;

export function walletAccountRole(account: Account): WalletAccountRole {
    const t = String(account.type ?? '');
    if (t === 'poupanca') return 'savings';
    if (t === 'investimento') return 'investment';
    if (t === 'cofrinho') return 'cofrinho';
    if (t === 'alimentacao' || t === 'refeicao' || isBenefitWalletInstitution(t)) return 'benefit_institution';
    if (isBenefitCardType(t)) return t === 'vale_refeicao' ? 'meal' : 'food';
    if (isCreditCardType(t) && !account.linkedAccountId) return 'store';
    if (isCreditCardType(t)) return 'credit';
    if (isBankCardType(t) || t === 'cartao_debito') return 'debit';
    if (isWalletInstitutionAccount(account) || t === 'conta_corrente' || t === 'dinheiro' || t === 'outros') {
        return 'bank';
    }
    return 'bank';
}

export function walletKindFromAccount(account: Account): WalletAccountKind {
    return walletAccountRole(account);
}

export function walletTypeFromKind(kind: WalletAccountKind): string {
    if (kind === 'bank') return 'conta_corrente';
    if (kind === 'savings') return 'poupanca';
    if (kind === 'investment') return 'investimento';
    if (kind === 'benefit_institution') return 'alimentacao';
    if (kind === 'cofrinho') return 'cofrinho';
    if (kind === 'credit' || kind === 'store') return 'cartao_credito';
    if (kind === 'food') return 'vale_alimentacao';
    if (kind === 'meal') return 'vale_refeicao';
    return 'cartao_debito';
}

export function isWalletCatalogPlastic(account: Account): boolean {
    const t = String(account.type ?? '');
    return isCardAccountType(t) || isBenefitCardType(t);
}

const WALLET_CARD_KINDS = new Set<WalletAccountKind>(['credit', 'store', 'debit', 'food', 'meal']);

export function isWalletCardKind(kind: WalletAccountKind): boolean {
    return WALLET_CARD_KINDS.has(kind);
}

const ALL_KINDS = new Set<WalletAccountKind>(WALLET_ACCOUNT_KIND_OPTIONS.map((o) => o.value));

/** Corrente e poupança — mesmo critério do «Saldo em conta» (sem investimento/cofrinho). */
export const WALLET_CASH_PRIMARY_KINDS = new Set<WalletAccountKind>(['bank', 'savings']);

const TYPE_RESOLVE_PRIORITY: WalletAccountKind[] = [
    'benefit_institution',
    'bank',
    'savings',
    'investment',
    'cofrinho',
    'food',
    'meal',
    'credit',
    'store',
    'debit'
];

function expandBenefitInstitutionInKinds(kinds: WalletAccountKind[]): WalletAccountKind[] {
    const out = kinds.filter((k) => k !== 'benefit_institution');
    if (kinds.includes('benefit_institution')) {
        if (!out.includes('food')) out.push('food');
        if (!out.includes('meal')) out.push('meal');
    }
    return [...new Set(out)];
}

export function walletKindsFromAccount(account: Account): WalletAccountKind[] {
    const raw = account.walletFunctions;
    if (Array.isArray(raw) && raw.length > 0) {
        const parsed = raw
            .filter((k): k is WalletAccountKind => ALL_KINDS.has(k as WalletAccountKind))
            .filter((k) => k !== 'benefit_institution');
        const expanded = expandBenefitInstitutionInKinds(
            raw.includes('benefit_institution') ? [...parsed, 'benefit_institution'] : parsed
        );
        if (expanded.length > 0) return expanded;
    }
    const role = walletAccountRole(account);
    if (role === 'benefit_institution') return ['food', 'meal'];
    return [role];
}

export function accountHasWalletKind(account: Account, kind: WalletAccountKind): boolean {
    return walletKindsFromAccount(account).includes(kind);
}

export function resolveTypeFromKinds(kinds: WalletAccountKind[]): string {
    const set = new Set(kinds);
    const hasFood = set.has('food');
    const hasMeal = set.has('meal');
    const hasBenefit = hasFood || hasMeal;
    const hasCashBase =
        set.has('bank') || set.has('savings') || set.has('investment') || set.has('cofrinho');

    if (hasBenefit && hasCashBase && !set.has('credit') && !set.has('debit') && !set.has('store')) {
        return 'alimentacao';
    }
    if (hasBenefit && !hasCashBase) {
        if (hasFood && hasMeal) return 'alimentacao';
        if (hasMeal) return 'vale_refeicao';
        if (hasFood) return 'vale_alimentacao';
    }

    for (const p of TYPE_RESOLVE_PRIORITY) {
        if (p === 'benefit_institution' || p === 'food' || p === 'meal') continue;
        if (set.has(p)) return walletTypeFromKind(p);
    }
    if (hasMeal) return 'vale_refeicao';
    if (hasFood) return 'vale_alimentacao';
    return walletTypeFromKind(kinds[0] ?? 'bank');
}

export function kindsNeedCreditFields(kinds: WalletAccountKind[]): boolean {
    return kinds.some((k) => k === 'credit' || k === 'store');
}

export function kindsNeedCardLink(kinds: WalletAccountKind[]): boolean {
    const set = new Set(kinds);
    if (set.has('credit') || set.has('store') || set.has('debit')) return true;
    const hasBenefit = set.has('food') || set.has('meal');
    if (!hasBenefit) return false;
    const isBenefitHome =
        set.has('bank') ||
        set.has('savings') ||
        set.has('investment') ||
        (set.has('food') && set.has('meal'));
    return !isBenefitHome;
}

export function kindsShowBalanceField(kinds: WalletAccountKind[]): boolean {
    return kinds.some((k) => !isWalletCardKind(k));
}