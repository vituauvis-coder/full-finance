import { creditCardInstallmentsDueInCalendarMonth } from '@motor/dinheiro/wallet-invoice-month.js';
import {
    isCardAccountType as isLegacyCardAccountType,
    isBenefitCardType,
    walletPlasticSlotForCardType
} from '@legacy/js/core/utils.js';
import {
    isCardAccountType,
    isCreditCardType,
    isBankAccount,
    sumCardSpendInMonth
} from '../../../lib/accounts';
import {
    accountTypeDisplayLabel,
    isBenefitWalletInstitution,
    isWalletInstitutionAccount
} from '../../../lib/walletAccountLabels';
import { resolveBankThemeClass } from '../../../lib/walletTheme';
import type { Account, FinanceData, Movement, UserProfile } from '../../../lib/types/finance';
import { acceptedOutgoingSplits } from '../../dashboard/domain/splitRequestsForBalance';

export type WalletInstitutionRowModel =
    | {
          kind: 'bank';
          tint: number;
          bank: Account;
          themeClass: string;
          walletMode: 'bank' | 'benefit';
          creditCards: Account[];
          debitCards: Account[];
      }
    | {
          kind: 'orphan-credit' | 'orphan-debit' | 'orphan-benefit';
          tint: number;
          card: Account;
          themeClass: string;
          benefitSlot?: 'food' | 'meal';
      };

function normalizeBankId(id: unknown) {
    return String(id ?? '').trim();
}

function linksToInstitution(card: Account, institutionId: string) {
    return normalizeBankId(card.linkedAccountId) === normalizeBankId(institutionId);
}

function bankIdSet(accounts: Account[]) {
    return new Set(accounts.filter(isBankAccount).map((a) => normalizeBankId(a.id)));
}

function linkedBenefitSlotCards(institutionId: string, institutionType: string, accs: Account[]) {
    const food: Account[] = [];
    const meal: Account[] = [];
    for (const c of accs) {
        if (!linksToInstitution(c, institutionId) || !isLegacyCardAccountType(c.type)) continue;
        const slot = walletPlasticSlotForCardType(c.type, institutionType);
        if (slot === 'food') food.push(c);
        else if (slot === 'meal') meal.push(c);
    }
    return { food, meal };
}

export function walletInstitutionRows(
    data: FinanceData,
    year: number,
    monthIndex0: number
): WalletInstitutionRowModel[] {
    const { userAccounts: accs, userExpenses: exps, userProfile: prof } = data;
    const banks = bankIdSet(accs);
    const linkedOk = (lid?: string) => {
        const id = normalizeBankId(lid);
        return !!(id && banks.has(id));
    };
    const splits = acceptedOutgoingSplits(data.expenseSplitRequests);

    const creditCards = accs.filter((a) => isCreditCardType(a.type));
    const debitCards = accs.filter((a) => String(a.type ?? '') === 'cartao_debito');

    const linkedCredit = (id: string) => creditCards.filter((c) => linksToInstitution(c, id));
    const linkedDebit = (id: string) => debitCards.filter((c) => linksToInstitution(c, id));

    const institutionBanks = accs.filter((a) => !isCardAccountType(a.type) && isWalletInstitutionAccount(a));

    const sortedBanks = institutionBanks
        .map((acc) => {
            const benefit = isBenefitWalletInstitution(acc.type);
            let spendScore = 0;
            if (benefit) {
                const { food, meal } = linkedBenefitSlotCards(acc.id, acc.type, accs);
                for (const c of [...food, ...meal]) {
                    spendScore += sumCardSpendInMonth(c.id, exps, year, monthIndex0);
                }
            } else {
                for (const c of linkedCredit(acc.id)) {
                    spendScore += creditCardInstallmentsDueInCalendarMonth(
                        c,
                        exps,
                        year,
                        monthIndex0,
                        prof,
                        splits,
                        exps
                    );
                }
            }
            return { acc, spendScore };
        })
        .sort((a, b) => {
            if (b.spendScore !== a.spendScore) return b.spendScore - a.spendScore;
            return String(a.acc.name).localeCompare(String(b.acc.name), 'pt-BR');
        });

    const rows: WalletInstitutionRowModel[] = [];
    let tint = 0;

    for (const { acc } of sortedBanks) {
        const walletMode = isBenefitWalletInstitution(acc.type) ? 'benefit' : 'bank';
        let slot1Cards: Account[];
        let slot2Cards: Account[];
        if (walletMode === 'benefit') {
            const slots = linkedBenefitSlotCards(acc.id, acc.type, accs);
            slot1Cards = slots.food;
            slot2Cards = slots.meal;
        } else {
            slot1Cards = linkedCredit(acc.id);
            slot2Cards = linkedDebit(acc.id);
        }
        rows.push({
            kind: 'bank',
            tint: tint++,
            bank: acc,
            themeClass: resolveBankThemeClass(acc.name),
            walletMode,
            creditCards: slot1Cards,
            debitCards: slot2Cards
        });
    }

    const orphanCredits = creditCards
        .filter((c) => !linkedOk(c.linkedAccountId))
        .sort((a, b) => {
            const sa = creditCardInstallmentsDueInCalendarMonth(a, exps, year, monthIndex0, prof, splits, exps);
            const sb = creditCardInstallmentsDueInCalendarMonth(b, exps, year, monthIndex0, prof, splits, exps);
            if (sb !== sa) return sb - sa;
            return String(a.name).localeCompare(String(b.name), 'pt-BR');
        });

    for (const c of orphanCredits) {
        rows.push({
            kind: 'orphan-credit',
            tint: tint++,
            card: c,
            themeClass: resolveBankThemeClass(c.name)
        });
    }

    const orphanDebits = debitCards
        .filter((c) => !linkedOk(c.linkedAccountId))
        .sort((a, b) => String(a.name).localeCompare(String(b.name), 'pt-BR'));

    for (const c of orphanDebits) {
        rows.push({
            kind: 'orphan-debit',
            tint: tint++,
            card: c,
            themeClass: resolveBankThemeClass(c.name)
        });
    }

    const benefitCards = accs.filter((a) => isBenefitCardType(a.type));
    const orphanBenefit = benefitCards
        .filter((c) => !linkedOk(c.linkedAccountId))
        .sort((a, b) => String(a.name).localeCompare(String(b.name), 'pt-BR'));

    for (const c of orphanBenefit) {
        const benefitSlot: 'food' | 'meal' = c.type === 'vale_refeicao' ? 'meal' : 'food';
        rows.push({
            kind: 'orphan-benefit',
            tint: tint++,
            card: c,
            themeClass: resolveBankThemeClass(c.name),
            benefitSlot
        });
    }

    return rows;
}

export function accountTypeLabelForRow(acc: Account) {
    return accountTypeDisplayLabel(acc.type);
}

export type WalletActivityItem = {
    date?: Movement['date'];
    label: string;
    amount: number;
    cardName: string;
    inst?: { index: number; total: number } | null;
};