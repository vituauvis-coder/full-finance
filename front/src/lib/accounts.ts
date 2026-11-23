import { accountUniquenessKey } from '@motor/dinheiro/account-uniqueness.js';
import { accountEligibleForExpensePix } from '@motor/dinheiro/expense-payment-accounts.js';
import { dedupeAccountsByInstitutionName } from '@motor/dinheiro/account-select-dedupe.js';
import type { Account } from './types/finance';
import { EXPENSE_LOAN_PAYMENT_VALUE } from './loanExpense';
import {
    accountSelectDisplayName,
    accountsOwnedByUser,
    ambiguousAccountNameKeys,
    dedupeAccountsByUniqueness
} from './accountSelectOptions';

export function isPixBankAccountType(type?: string) {
    const t = String(type ?? '');
    return t === 'conta_corrente' || t === 'poupanca';
}

export function isCreditCardType(type?: string) {
    const t = String(type ?? '').toLowerCase();
    return t.includes('credito') || t.includes('crédito') || t === 'cartao_credito' || t === 'credit';
}

export function isCardAccountType(type?: string) {
    const t = String(type ?? '').toLowerCase();
    return (
        isCreditCardType(t) ||
        t.includes('debito') ||
        t.includes('débito') ||
        t === 'cartao_debito' ||
        t.includes('beneficio') ||
        t.includes('benefício')
    );
}

export function isBankAccount(account: Account) {
    return account.type && !isCardAccountType(account.type);
}

/** Mesma regra do legado `isCashBalanceAccountType` — saldo em conta no dashboard. */
export function isCashBalanceAccountType(type?: string) {
    const t = String(type ?? '');
    if (isCardAccountType(t)) return false;
    if (t === 'investimento' || t === 'cofrinho') return false;
    if (t === 'alimentacao' || t === 'refeicao') return false;
    return Boolean(t);
}

export function sortedBankAccounts(accounts: Account[]) {
    return dedupeAccountsByUniqueness(accounts.filter(isBankAccount));
}

export function sortedCardAccounts(accounts: Account[]) {
    return dedupeAccountsByUniqueness(accounts.filter((a) => isCardAccountType(a.type)));
}

export type PaymentOption = { value: string; label: string; group: 'pix' | 'card' };

export function buildPaymentMethodOptions(
    accounts: Account[],
    opts?: { includeLoan?: boolean; ownerUserId?: string | null; alwaysIncludeAccountIds?: string[] }
): PaymentOption[] {
    const all = accounts ?? [];
    let pool = all;
    if (opts?.ownerUserId) pool = accountsOwnedByUser(pool, opts.ownerUserId);

    const banks = dedupeAccountsByInstitutionName(
        pool.filter((a) => accountEligibleForExpensePix(a) && isBankAccount(a))
    );
    const cards = dedupeAccountsByUniqueness(pool.filter((a) => isCardAccountType(a.type)));

    const holderIds = new Set(
        pool.map((a) => String(a.holderUserId ?? a.userId ?? '').trim()).filter(Boolean)
    );
    const ambiguous =
        holderIds.size > 1 ? ambiguousAccountNameKeys([...banks, ...cards]) : new Set<string>();

    const out: PaymentOption[] = [];
    const seenPix = new Set<string>();
    for (const b of banks) {
        const ukey = accountUniquenessKey(b) ?? b.id;
        if (seenPix.has(ukey)) continue;
        seenPix.add(ukey);
        const label = accountSelectDisplayName(b, ambiguous);
        out.push({ value: b.id, label: `PIX — ${label}`, group: 'pix' });
    }
    const seenCard = new Set<string>();
    for (const c of cards) {
        const ukey = accountUniquenessKey(c) ?? c.id;
        if (seenCard.has(ukey)) continue;
        seenCard.add(ukey);
        const kind = isCreditCardType(c.type) ? 'crédito' : 'débito';
        const label = accountSelectDisplayName(c, ambiguous);
        out.push({ value: c.id, label: `${label} (${kind})`, group: 'card' });
    }
    if (opts?.includeLoan) {
        out.push({ value: EXPENSE_LOAN_PAYMENT_VALUE, label: 'Empréstimo', group: 'pix' });
    }

    const have = new Set(out.map((o) => String(o.value)));
    for (const rawId of opts?.alwaysIncludeAccountIds ?? []) {
        const id = String(rawId ?? '').trim();
        if (!id || have.has(id)) continue;
        const acc = all.find((a) => String(a.id) === id);
        if (!acc) continue;
        const label = accountSelectDisplayName(acc, ambiguous);
        if (isCardAccountType(acc.type)) {
            const kind = isCreditCardType(acc.type) ? 'crédito' : 'débito';
            out.push({ value: id, label: `${label} (${kind})`, group: 'card' });
        } else if (accountEligibleForExpensePix(acc)) {
            out.push({ value: id, label: `PIX — ${label}`, group: 'pix' });
        }
        have.add(id);
    }

    return out;
}

export function resolvePaymentMethod(paymentValue: string, accounts: Account[], loanAccountId?: string) {
    if (paymentValue === EXPENSE_LOAN_PAYMENT_VALUE) {
        const acc = accounts.find((a) => a.id === loanAccountId);
        if (!acc) return null;
        return { accountId: acc.id, isPaid: true };
    }
    const acc = accounts.find((a) => a.id === paymentValue);
    if (!acc) return null;
    if (isCreditCardType(acc.type)) return { accountId: acc.id, isPaid: false };
    return { accountId: acc.id, isPaid: true };
}

export function sumCardSpendInMonth(
    cardId: string,
    expenses: { accountId?: string; amount?: number; date?: string | { seconds?: number } }[],
    year: number,
    monthIndex: number
) {
    let sum = 0;
    for (const e of expenses) {
        if (String(e.accountId) !== cardId) continue;
        const d =
            e.date != null && typeof e.date === 'object' && e.date.seconds != null
                ? new Date(e.date.seconds * 1000)
                : new Date(e.date as string);
        if (Number.isNaN(d.getTime())) continue;
        if (d.getFullYear() === year && d.getMonth() === monthIndex) sum += Number(e.amount) || 0;
    }
    return sum;
}