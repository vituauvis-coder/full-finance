import {
    cashBalanceLabelPenalty,
    linkedPlasticCountForInstitution
} from '@motor/dinheiro/cash-balance-label.js';
import { normalizeInstitutionKey } from '@motor/dinheiro/account-uniqueness.js';
import { pickPrimaryCashAccounts } from '@motor/dinheiro/primary-cash-balance.js';
import { isCashBalanceAccountType } from '../../../lib/accounts';
import { normalizeFinanceAccounts } from '../../../lib/normalizeAccounts';
import type { Account, Movement } from '../../../lib/types/finance';

/** Agrupa Itaú / Itau / «Itaú Personnalité» etc. para saldo (não mistura titulares). */
export function institutionNamesMatchForBalance(a: string, b: string): boolean {
    const ka = normalizeInstitutionKey(a);
    const kb = normalizeInstitutionKey(b);
    if (!ka || !kb) return false;
    if (ka === kb) return true;
    const shorter = ka.length <= kb.length ? ka : kb;
    const longer = ka.length <= kb.length ? kb : ka;
    return shorter.length >= 4 && longer.startsWith(shorter);
}

function accountHolderKey(acc: Account & { holder_user_id?: string; user_id?: string }): string {
    return String(acc.holderUserId ?? acc.holder_user_id ?? acc.userId ?? acc.user_id ?? '').trim();
}

function cashPeersWithSameLabel(focus: Account, accounts: Account[]): Account[] {
    const focusHolder = accountHolderKey(focus);
    return accounts.filter((a) => {
        if (!isCashBalanceAccountType(a.type)) return false;
        if (focusHolder) {
            const h = accountHolderKey(a);
            if (h && h !== focusHolder) return false;
        }
        return institutionNamesMatchForBalance(a.name ?? '', focus.name ?? '');
    });
}

function directMovementCount(accountId: string, expenses: Movement[], gains: Movement[]): number {
    const id = String(accountId);
    let n = 0;
    for (const e of expenses) {
        if (String(e.accountId) === id) n += 1;
    }
    for (const g of gains) {
        if (String(g.accountId) === id) n += 1;
    }
    return n;
}

/** Contas duplicadas (migração legado) — exibe a «conta leve», não a que absorveu todos os lançamentos. */
const DUPLICATE_INSTITUTION_MOVE_CAP = 25;

function institutionCashPeerForBalance(
    focus: Account,
    accounts: Account[],
    expenses: Movement[],
    gains: Movement[]
): Account {
    const peers = cashPeersWithSameLabel(focus, accounts);
    if (peers.length <= 1) return focus;

    const scored = peers.map((p) => ({
        acc: p,
        moves: directMovementCount(p.id, expenses, gains),
        primary: Boolean(p.isPrimaryCash)
    }));
    scored.sort((a, b) => a.moves - b.moves || a.acc.id.localeCompare(b.acc.id));

    const minMoves = scored[0]?.moves ?? 0;
    const moveCutoff = Math.max(DUPLICATE_INSTITUTION_MOVE_CAP, minMoves + 15);
    let pool = scored.filter((s) => s.moves <= moveCutoff);
    if (pool.length === 0) pool = scored;

    const primaryLight = pool.filter((s) => s.primary && s.moves <= DUPLICATE_INSTITUTION_MOVE_CAP);
    if (primaryLight.length === 1) return primaryLight[0].acc;
    if (primaryLight.length > 1) {
        primaryLight.sort((a, b) => a.moves - b.moves || a.acc.id.localeCompare(b.acc.id));
        return primaryLight[0].acc;
    }

    const light = pool.filter((s) => s.moves <= DUPLICATE_INSTITUTION_MOVE_CAP);
    if (light.length > 0) return light[0].acc;

    return pool[0]?.acc ?? focus;
}

function accountBalance(acc: Account): number {
    return Number(acc.balance ?? acc.initialBalance) || 0;
}

const CASH_DISPLAY_TYPE_RANK = new Map<string, number>([
    ['conta_corrente', 0],
    ['poupanca', 1],
    ['dinheiro', 2],
    ['outros', 3]
]);

function rankCashAccountsForDisplay(list: Account[]) {
    const banks = list.filter((a) => isCashBalanceAccountType(a.type));
    if (banks.length === 0) return { ranked: [] as Account[], scope: [] as Account[] };

    const correnteOrPoupanca = banks.filter(
        (a) => a.type === 'conta_corrente' || a.type === 'poupanca'
    );
    const scope = correnteOrPoupanca.length > 0 ? correnteOrPoupanca : banks;

    const ranked = [...scope].sort((a, b) => {
        const pa = cashBalanceLabelPenalty(a.name);
        const pb = cashBalanceLabelPenalty(b.name);
        if (pa !== pb) return pa - pb;
        const la = linkedPlasticCountForInstitution(a.id, list);
        const lb = linkedPlasticCountForInstitution(b.id, list);
        if (lb !== la) return lb - la;
        const ra = CASH_DISPLAY_TYPE_RANK.get(String(a.type ?? '')) ?? 9;
        const rb = CASH_DISPLAY_TYPE_RANK.get(String(b.type ?? '')) ?? 9;
        if (ra !== rb) return ra - rb;
        const ba = accountBalance(a);
        const bb = accountBalance(b);
        if (bb !== ba) return bb - ba;
        return a.name.localeCompare(b.name, 'pt-BR');
    });

    return { ranked, scope };
}

/** Contas do titular logado — não mistura outro membro da casa com o mesmo nome de banco. */
export function scopeAccountsToViewer(accounts: Account[], viewerUserId?: string | null): Account[] {
    const vid = String(viewerUserId ?? '').trim();
    if (!vid) return accounts;
    const scoped = accounts.filter((a) => {
        const holder = accountHolderKey(a);
        return !holder || holder === vid;
    });
    return scoped.length > 0 ? scoped : accounts;
}

/**
 * Conta cujo saldo deve aparecer junto do rótulo «Saldo em conta».
 * `null` = somar todas as contas de caixa (rótulo agregado «X +N»).
 */
export function resolveSaldoEmContaFocusAccount(
    accounts: Account[],
    expenses: Movement[] = [],
    gains: Movement[] = [],
    viewerUserId?: string | null
): Account | null {
    const list = scopeAccountsToViewer(normalizeFinanceAccounts(accounts), viewerUserId);

  const primaryFlagged = list.filter(
        (a) => Boolean(a.isPrimaryCash) && isCashBalanceAccountType(a.type)
    );
    if (primaryFlagged.length >= 1) {
        const seed = [...primaryFlagged].sort(
            (a, b) => accountBalance(b) - accountBalance(a) || a.id.localeCompare(b.id)
        )[0];
        return institutionCashPeerForBalance(seed, list, expenses, gains);
    }

    const primaryPick = pickPrimaryCashAccounts(list, isCashBalanceAccountType);
    if (primaryPick?.length === 1) {
        return institutionCashPeerForBalance(primaryPick[0], list, expenses, gains);
    }

    const { ranked, scope } = rankCashAccountsForDisplay(list);
    if (ranked.length === 0) return null;
    if (scope.length === 1) {
        return institutionCashPeerForBalance(ranked[0], list, expenses, gains);
    }

    const top = ranked[0];
    return institutionCashPeerForBalance(top, list, expenses, gains);
}

/** Rótulo do saldo em conta — prioriza a conta principal (uma só, como no backend). */
export function dashboardBalanceAccountTag(accounts: Account[]): string | null {
    const list = normalizeFinanceAccounts(accounts);
    const focus = resolveSaldoEmContaFocusAccount(list, [], []);
    if (focus) {
        const name = (focus.name || '').trim();
        return name || null;
    }

    const { ranked, scope } = rankCashAccountsForDisplay(list);
    if (ranked.length === 0) return null;
    const top = ranked[0];
    const name = (top.name || '').trim();
    if (!name) return null;
    if (scope.length === 1) return name;

    const second = ranked[1];
    const topBal = accountBalance(top);
    const secondBal = accountBalance(second);
    if (second && topBal > 0 && secondBal / topBal >= 0.85) {
        return `${name} +${scope.length - 1}`;
    }

    return name;
}

export function primaryCashAccountForBalance(accounts: Account[]): Account | null {
    const pick = pickPrimaryCashAccounts(normalizeFinanceAccounts(accounts), isCashBalanceAccountType);
    return pick?.[0] ?? null;
}