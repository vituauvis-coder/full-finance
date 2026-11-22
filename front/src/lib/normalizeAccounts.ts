import type { Account } from './types/finance';

/** Garante `isPrimaryCash` mesmo se o JSON vier com snake_case ou omisso. */
function truthyPrimary(v: unknown): boolean {
    return v === true || v === 1 || v === '1' || v === 'true';
}

export function normalizeFinanceAccount(raw: Account & { is_primary_cash?: unknown }): Account {
    const flagged = truthyPrimary(raw.isPrimaryCash) || truthyPrimary(raw.is_primary_cash);
    return {
        ...raw,
        isPrimaryCash: flagged
    };
}

export function normalizeFinanceAccounts(accounts: Account[] | undefined | null): Account[] {
    return (accounts ?? []).map((a) => normalizeFinanceAccount(a as Account & { is_primary_cash?: boolean }));
}