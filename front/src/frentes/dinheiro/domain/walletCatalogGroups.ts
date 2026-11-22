import { walletPlasticSlotForCardType } from '@legacy/js/core/utils.js';
import { isCreditCardType, sumCardSpendInMonth } from '../../../lib/accounts';
import { accountTypeDisplayLabel } from '../../../lib/walletAccountLabels';
import type { Account, FinanceData, Movement } from '../../../lib/types/finance';
import { walletInstitutionRows, type WalletInstitutionRowModel } from './walletInstitutions';
import {
    accountHasWalletKind,
    walletAccountRole,
    walletKindsFromAccount,
    type WalletAccountKind
} from '../wallet/walletAccountKind';
import { sortWalletCatalogGroups } from './walletCatalogSort';
import { enrichInstitutionWalletFunctions } from '@motor/dinheiro/wallet-institution-functions.js';
import { summarizeWalletAccountCofrinho } from '@motor/dinheiro/wallet-account-cofrinho.js';
import { walletDisplayCashBalance } from './walletCashBalance';

export type CatalogFacetKind =
    | 'balance'
    | 'credit'
    | 'debit'
    | 'food'
    | 'meal'
    | 'store'
    | 'cofrinho'
    | 'investment'
    | 'savings';

export type WalletCatalogFacet =
    | {
          kind: 'balance' | 'investment' | 'savings';
          account: Account;
          label: string;
          amount: number;
      }
    | {
          kind: 'credit';
          card: Account;
          invoice: number;
          limit: number;
          dueDay?: number | null;
          closeDay?: number | null;
      }
    | {
          kind: 'debit' | 'food' | 'meal' | 'store';
          card: Account;
          spend: number;
      }
    | {
          kind: 'cofrinho';
          account: Account;
          balance: number;
          monthApplied: number;
          /** Aportes na vida (contas de saída). */
          accumulated: number;
          /** Gastos pagos do cofrinho atribuídos à conta. */
          withdrawn: number;
          net: number;
          monthAccumulated: number;
          monthWithdrawn: number;
          lastEventAt: string | null;
          /** Conta usada no extrato (Saídas) para somar aportes. */
          ledgerAccountId?: string;
      };

export type WalletCatalogGroup = {
    id: string;
    title: string;
    row: WalletInstitutionRowModel;
    primaryAccount: Account;
    themeClass: string;
    facets: WalletCatalogFacet[];
    facetKinds: CatalogFacetKind[];
};

function kindToFacetKind(kind: WalletAccountKind): CatalogFacetKind | null {
    if (kind === 'bank') return 'balance';
    if (kind === 'savings') return 'savings';
    if (kind === 'investment') return 'investment';
    if (kind === 'cofrinho') return 'cofrinho';
    if (kind === 'credit') return 'credit';
    if (kind === 'store') return 'store';
    if (kind === 'debit') return 'debit';
    if (kind === 'food') return 'food';
    if (kind === 'meal') return 'meal';
  return null;
}

const FACET_KIND_ORDER: CatalogFacetKind[] = [
    'balance',
    'savings',
    'investment',
    'credit',
    'store',
    'debit',
    'food',
    'meal',
    'cofrinho'
];

export const FACET_CHIP_LABELS: Record<CatalogFacetKind, string> = {
    balance: 'Conta',
    savings: 'Poupança',
    investment: 'Investimento',
    credit: 'Crédito',
    store: 'Loja',
    debit: 'Débito',
    food: 'VA',
    meal: 'VR',
    cofrinho: 'Cofrinho'
};

function balanceLabelForAccount(acc: Account): string {
    const role = walletAccountRole(acc);
    if (role === 'savings') return 'Poupança';
    if (role === 'investment') return 'Investimento';
    if (role === 'benefit_institution') return accountTypeDisplayLabel(acc.type);
    return 'Saldo em conta';
}

function balanceFacetKind(acc: Account): 'balance' | 'investment' | 'savings' {
    const role = walletAccountRole(acc);
    if (role === 'savings') return 'savings';
    if (role === 'investment') return 'investment';
    return 'balance';
}

/** Conta com função cofrinho (walletFunctions) ou tipo dedicado. */
function accountSupportsCofrinhoLedger(acc: Account): boolean {
    return accountHasWalletKind(acc, 'cofrinho') || String(acc.type) === 'cofrinho';
}

/**
 * ID usado nas Saídas (`movement.accountId`) para aportes desta conta.
 * Corrente com função cofrinho → o próprio id; plástico `cofrinho` → conta mãe se houver.
 */
function cofrinhoLedgerAccountId(acc: Account): string | null {
    if (!accountSupportsCofrinhoLedger(acc)) return null;
    if (String(acc.type) === 'cofrinho') {
        const parent = String(acc.linkedAccountId ?? '').trim();
        return parent || String(acc.id);
    }
    return String(acc.id);
}

function cofrinhoSummaryForAccountId(
    ledgerAccountId: string,
    expenses: Movement[],
    year: number,
    monthIndex: number
) {
    return summarizeWalletAccountCofrinho(expenses, new Set([ledgerAccountId]), { year, monthIndex });
}

function linkedCofrinhos(bankId: string, accounts: Account[]) {
    return accounts.filter(
        (a) =>
            String(a.type) === 'cofrinho' &&
            String(a.linkedAccountId ?? '').trim() === String(bankId).trim()
    );
}

function pushPlasticFacets(
    facets: WalletCatalogFacet[],
    kinds: Set<CatalogFacetKind>,
    cards: Account[],
    institution: Account,
    data: FinanceData,
    year: number,
    monthIndex: number,
    creditAmount: (card: Account) => number
) {
    for (const card of cards) {
        const slot = walletPlasticSlotForCardType(card.type, String(institution.type ?? ''));
        if (slot === 'credit') {
            const invoice = creditAmount(card);
            kinds.add('credit');
            facets.push({
                kind: 'credit',
                card,
                invoice,
                limit: Number(card.limit) || 0,
                dueDay: card.dueDay,
                closeDay: card.closeDay ?? card.closingDay ?? null
            });
            continue;
        }
        if (slot === 'food') {
            kinds.add('food');
            facets.push({
                kind: 'food',
                card,
                spend: sumCardSpendInMonth(card.id, data.userExpenses, year, monthIndex)
            });
            continue;
        }
        if (slot === 'meal') {
            kinds.add('meal');
            facets.push({
                kind: 'meal',
                card,
                spend: sumCardSpendInMonth(card.id, data.userExpenses, year, monthIndex)
            });
            continue;
        }
        if (isCreditCardType(card.type) && !card.linkedAccountId) {
            kinds.add('store');
            facets.push({
                kind: 'store',
                card,
                spend: creditAmount(card)
            });
            continue;
        }
        kinds.add('debit');
        facets.push({
            kind: 'debit',
            card,
            spend: sumCardSpendInMonth(card.id, data.userExpenses, year, monthIndex)
        });
    }
}

function groupFromRow(
    row: WalletInstitutionRowModel,
    data: FinanceData,
    year: number,
    monthIndex: number,
    creditAmount: (card: Account) => number
): WalletCatalogGroup {
    const facets: WalletCatalogFacet[] = [];
    const kinds = new Set<CatalogFacetKind>();

    if (row.kind === 'bank') {
        const bank = row.bank;
        const balanceKind = balanceFacetKind(bank);
        kinds.add(balanceKind);
        facets.push({
            kind: balanceKind,
            account: bank,
            label: balanceLabelForAccount(bank),
            amount: walletDisplayCashBalance(data, bank, { year, monthIndex })
        });

        pushPlasticFacets(
            facets,
            kinds,
            [...row.creditCards, ...row.debitCards],
            bank,
            data,
            year,
            monthIndex,
            creditAmount
        );

        const linked = linkedCofrinhos(bank.id, data.userAccounts);
        /** Saídas gravam `accountId` na conta de pagamento (corrente) — sempre o id da instituição no catálogo. */
        const ledgerId = String(bank.id);
        const cofrinhoStats = cofrinhoSummaryForAccountId(
            ledgerId,
            data.userExpenses,
            year,
            monthIndex
        );
        const hasLedgerActivity =
            cofrinhoStats.accumulated > 0 ||
            cofrinhoStats.withdrawn > 0 ||
            Boolean(cofrinhoStats.lastEventAt);
        const supportsCofrinho =
            accountSupportsCofrinhoLedger(bank) || linked.some(accountSupportsCofrinhoLedger);
        if (supportsCofrinho || hasLedgerActivity) {
            const monthApplied = cofrinhoStats.monthAccumulated - cofrinhoStats.monthWithdrawn;
            const displayAccount = linked.find(accountSupportsCofrinhoLedger) ?? bank;
            kinds.add('cofrinho');
            facets.push({
                kind: 'cofrinho',
                account: displayAccount,
                balance: Number(displayAccount.balance) || 0,
                monthApplied,
                ledgerAccountId: ledgerId,
                ...cofrinhoStats
            });
        }

        for (const fn of walletKindsFromAccount(bank)) {
            const facet = kindToFacetKind(fn);
            if (facet && facet !== 'cofrinho') kinds.add(facet);
        }

        const facetKinds = FACET_KIND_ORDER.filter((k) => kinds.has(k));
        return {
            id: bank.id,
            title: bank.name,
            row,
            primaryAccount: bank,
            themeClass: row.themeClass,
            facets,
            facetKinds
        };
    }

    const card = row.card;
    if (row.kind === 'orphan-benefit') {
        const slot = row.benefitSlot === 'meal' ? 'meal' : 'food';
        kinds.add(slot);
        facets.push({
            kind: slot,
            card,
            spend: sumCardSpendInMonth(card.id, data.userExpenses, year, monthIndex)
        });
    } else {
        const pseudoInst = { type: '' } as Account;
        pushPlasticFacets(facets, kinds, [card], pseudoInst, data, year, monthIndex, creditAmount);
    }

    const bal = walletDisplayCashBalance(data, card, { year, monthIndex });
    if (bal !== 0) {
        kinds.add('balance');
        facets.unshift({
            kind: 'balance',
            account: card,
            label: 'Saldo',
            amount: bal
        });
    }

    for (const fn of walletKindsFromAccount(card)) {
        const facet = kindToFacetKind(fn);
        if (facet && facet !== 'cofrinho') kinds.add(facet);
    }

    const facetKinds = FACET_KIND_ORDER.filter((k) => kinds.has(k));
    return {
        id: card.id,
        title: card.name,
        row,
        primaryAccount: card,
        themeClass: row.themeClass,
        facets,
        facetKinds
    };
}

export function buildWalletCatalogGroups(
    data: FinanceData,
    year: number,
    monthIndex: number,
    creditAmount: (card: Account) => number
): WalletCatalogGroup[] {
    const bundle: FinanceData = {
        ...data,
        userAccounts: enrichInstitutionWalletFunctions(data.userAccounts)
    };
    const rows = walletInstitutionRows(bundle, year, monthIndex);
    const groups = rows.map((row) => groupFromRow(row, bundle, year, monthIndex, creditAmount));
    const seenIds = new Set(groups.map((g) => g.id));

    for (const acc of bundle.userAccounts) {
        if (seenIds.has(acc.id)) continue;
        if (!accountSupportsCofrinhoLedger(acc)) continue;
        const ledgerId = cofrinhoLedgerAccountId(acc);
        if (!ledgerId) continue;
        if (groups.some((g) => g.id === ledgerId)) continue;
        const facetKinds: CatalogFacetKind[] = ['cofrinho'];
        const stats = cofrinhoSummaryForAccountId(ledgerId, bundle.userExpenses, year, monthIndex);
        groups.push({
            id: acc.id,
            title: acc.name,
            row: {
                kind: 'orphan-debit',
                tint: 0,
                card: acc,
                themeClass: ''
            },
            primaryAccount: acc,
            themeClass: '',
            facets: [
                {
                    kind: 'cofrinho' as const,
                    account: acc,
                    balance: Number(acc.balance) || 0,
                    monthApplied: stats.monthAccumulated - stats.monthWithdrawn,
                    ledgerAccountId: ledgerId,
                    ...stats
                }
            ],
            facetKinds
        });
        seenIds.add(acc.id);
    }

    return sortWalletCatalogGroups(groups);
}