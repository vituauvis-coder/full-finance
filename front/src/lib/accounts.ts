import type { Account } from './types/finance';
import { EXPENSE_LOAN_PAYMENT_VALUE } from './loanExpense';

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

export function sortedBankAccounts(accounts: Account[]) {
    return accounts.filter(isBankAccount).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}

export function sortedCardAccounts(accounts: Account[]) {
    return accounts.filter((a) => isCardAccountType(a.type)).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}

export type PaymentOption = { value: string; label: string; group: 'pix' | 'card' };

export function buildPaymentMethodOptions(accounts: Account[], opts?: { includeLoan?: boolean }): PaymentOption[] {
    const out: PaymentOption[] = [];
    for (const b of sortedBankAccounts(accounts)) {
        out.push({ value: b.id, label: `PIX — ${b.name}`, group: 'pix' });
    }
    for (const c of sortedCardAccounts(accounts)) {
        const kind = isCreditCardType(c.type) ? 'crédito' : 'débito';
        out.push({ value: c.id, label: `${c.name} (${kind})`, group: 'card' });
    }
    if (opts?.includeLoan) {
        out.push({ value: EXPENSE_LOAN_PAYMENT_VALUE, label: 'Empréstimo', group: 'pix' });
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