import { accountUniquenessKey } from '@motor/dinheiro/account-uniqueness.js';
import {
    accountEligibleForSplitCredit,
    dedupeAccountsByInstitutionName
} from '@motor/dinheiro/account-select-dedupe.js';
import type { Account } from './types/finance';
import { accountHolderDisplayLabel } from './walletAccountLabels';

function compareAccountPick(a: Account, b: Account) {
    const aPri = a.isPrimaryCash ? 0 : 1;
    const bPri = b.isPrimaryCash ? 0 : 1;
    if (aPri !== bPri) return aPri - bPri;
    return String(a.id).localeCompare(String(b.id));
}

/** Colapsa contas duplicadas (mesmo titular+instituição+tipo) — ex.: migração com duas linhas Itaú. */
export function dedupeAccountsByUniqueness(accounts: Account[]): Account[] {
    const byKey = new Map<string, Account>();
    const rest: Account[] = [];

    for (const acc of accounts ?? []) {
        const key = accountUniquenessKey(acc);
        if (!key) {
            rest.push(acc);
            continue;
        }
        const prev = byKey.get(key);
        if (!prev || compareAccountPick(acc, prev) < 0) byKey.set(key, acc);
    }

    return [...byKey.values(), ...rest].sort((a, b) =>
        String(a.name ?? '').localeCompare(String(b.name ?? ''), 'pt-BR')
    );
}

export function accountsOwnedByUser(accounts: Account[], userId: string | null | undefined): Account[] {
    const uid = String(userId ?? '').trim();
    if (!uid) return accounts ?? [];
    return (accounts ?? []).filter((a) => String(a.userId ?? '') === uid);
}

export function ambiguousAccountNameKeys(accounts: Account[]): Set<string> {
    const counts = new Map<string, number>();
    for (const a of accounts) {
        const key = String(a.name ?? '')
            .trim()
            .toLowerCase();
        if (!key) continue;
        counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const ambiguous = new Set<string>();
    counts.forEach((n, k) => {
        if (n > 1) ambiguous.add(k);
    });
    return ambiguous;
}

export function accountSelectDisplayName(acc: Account, ambiguousNames: Set<string>): string {
    const base = String(acc.name ?? '').trim() || 'Conta';
    const key = base.toLowerCase();
    if (!ambiguousNames.has(key)) return base;
    const holder = accountHolderDisplayLabel(acc);
    return holder ? `${base} (${holder})` : base;
}

export type AccountSelectOption = { id: string; label: string };

export function buildAccountSelectOptions(
    accounts: Account[],
    opts?: { ownerUserId?: string | null }
): AccountSelectOption[] {
    let list = accounts ?? [];
    if (opts?.ownerUserId) list = accountsOwnedByUser(list, opts.ownerUserId);
    list = dedupeAccountsByUniqueness(list);
    const ambiguous = ambiguousAccountNameKeys(list);
    return list.map((a) => ({
        id: a.id,
        label: accountSelectDisplayName(a, ambiguous)
    }));
}

/** Conta corrente/poupança/etc. do usuário logado — uma por instituição, sem cartão. */
export function buildSplitCreditAccountOptions(
    accounts: Account[],
    ownerUserId: string | null | undefined
): AccountSelectOption[] {
    const uid = String(ownerUserId ?? '').trim();
    if (!uid) return [];

    const list = dedupeAccountsByInstitutionName(
        (accounts ?? []).filter(
            (a) => String(a.userId ?? '') === uid && accountEligibleForSplitCredit(a)
        )
    );

    return list.map((a) => ({
        id: a.id,
        label: String(a.name ?? '').trim() || 'Conta'
    }));
}