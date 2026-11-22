import { walletPlasticSlotForCardType, isCardAccountType as isLegacyCardType } from '@legacy/js/core/utils.js';
import { isCreditCardType, sumCardSpendInMonth } from '../../../lib/accounts';
import { isBenefitWalletInstitution, isWalletInstitutionAccount } from '../../../lib/walletAccountLabels';
import type { Account, FinanceData } from '../../../lib/types/finance';
import { walletInstitutionRows, type WalletInstitutionRowModel } from './walletInstitutions';
import { walletAccountRole, type WalletAccountRole } from '../wallet/walletAccountKind';

export type WalletCatalogEntry = {
    id: string;
    account: Account;
    institution?: Account | null;
    role: WalletAccountRole;
    plasticSlot: 'credit' | 'debit' | 'food' | 'meal' | null;
    walletMode: 'bank' | 'benefit';
    themeClass: string;
};

function roleForPlastic(card: Account, institution?: Account | null): WalletAccountRole {
    const instType = institution?.type;
    const slot = institution
        ? walletPlasticSlotForCardType(card.type, String(instType ?? ''))
        : walletPlasticSlotForCardType(card.type, '');
    if (slot === 'food' || slot === 'meal') return slot === 'meal' ? 'meal' : 'food';
    if (slot === 'debit') return 'debit';
    if (isCreditCardType(card.type) && !card.linkedAccountId) return 'store';
    if (slot === 'credit') return 'credit';
    return walletAccountRole(card);
}

function plasticEntry(
    card: Account,
    row: WalletInstitutionRowModel,
    institution?: Account | null
): WalletCatalogEntry {
    const inst = institution ?? (row.kind === 'bank' ? row.bank : null);
    const instType = inst?.type ?? '';
    const walletMode =
        row.kind === 'bank' && row.walletMode === 'benefit'
            ? 'benefit'
            : row.kind === 'orphan-benefit'
              ? 'benefit'
              : 'bank';
    const slot = walletPlasticSlotForCardType(card.type, String(instType ?? ''));
    const themeClass = row.themeClass ?? '';
    return {
        id: card.id,
        account: card,
        institution: inst,
        role: roleForPlastic(card, inst),
        plasticSlot: slot,
        walletMode,
        themeClass
    };
}

function institutionHasLinkedPlastic(institutionId: string, accounts: Account[]) {
    const id = String(institutionId).trim();
    return accounts.some(
        (c) => isLegacyCardType(c.type) && String(c.linkedAccountId ?? '').trim() === id
    );
}

export function buildWalletCatalogEntries(data: FinanceData, year: number, monthIndex: number): WalletCatalogEntry[] {
    const rows = walletInstitutionRows(data, year, monthIndex);
    const out: WalletCatalogEntry[] = [];
    const seenAccountIds = new Set<string>();

    function addEntry(entry: WalletCatalogEntry) {
        if (seenAccountIds.has(entry.account.id)) return;
        seenAccountIds.add(entry.account.id);
        out.push(entry);
    }

    for (const row of rows) {
        if (row.kind === 'bank') {
            const inst = row.bank;
            const cards = [...row.creditCards, ...row.debitCards];
            if (cards.length === 0) {
                if (isWalletInstitutionAccount(inst)) {
                    addEntry({
                        id: inst.id,
                        account: inst,
                        institution: inst,
                        role: walletAccountRole(inst),
                        plasticSlot: null,
                        walletMode: row.walletMode,
                        themeClass: row.themeClass
                    });
                }
                continue;
            }
            for (const card of cards) {
                addEntry(plasticEntry(card, row, inst));
            }
            continue;
        }

        if (row.kind === 'orphan-benefit' || row.kind === 'orphan-credit' || row.kind === 'orphan-debit') {
            addEntry(plasticEntry(row.card, row));
        }
    }

    for (const acc of data.userAccounts) {
        if (seenAccountIds.has(acc.id)) continue;
        if (isLegacyCardType(acc.type)) continue;
        if (institutionHasLinkedPlastic(acc.id, data.userAccounts)) continue;

        const role = walletAccountRole(acc);
        if (!isWalletInstitutionAccount(acc) && role !== 'cofrinho') continue;

        addEntry({
            id: acc.id,
            account: acc,
            institution: acc,
            role,
            plasticSlot: null,
            walletMode: isBenefitWalletInstitution(acc.type) ? 'benefit' : 'bank',
            themeClass: ''
        });
    }

    return out.sort((a, b) => {
        const order = (r: WalletAccountRole) => {
            if (r === 'bank' || r === 'savings' || r === 'investment' || r === 'benefit_institution') return 0;
            if (r === 'cofrinho') return 1;
            return 2;
        };
        const d = order(a.role) - order(b.role);
        if (d !== 0) return d;
        return a.account.name.localeCompare(b.account.name, 'pt-BR');
    });
}

export function catalogEntryMonthAmount(
    entry: WalletCatalogEntry,
    data: FinanceData,
    year: number,
    monthIndex: number,
    creditAmount: (card: Account) => number
) {
    const { account, plasticSlot } = entry;
    if (plasticSlot === 'credit') return creditAmount(account);
    if (plasticSlot) return sumCardSpendInMonth(account.id, data.userExpenses, year, monthIndex);
    return Number(account.balance) || 0;
}