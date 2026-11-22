import { useMemo } from 'react';
import { walletPlasticSlotForCardType } from '@legacy/js/core/utils.js';
import { buildWalletPlasticHtml } from '@motor/dinheiro/wallet-plastic.js';
import { formatBRL } from '../../../../lib/format';
import { sumCardSpendInMonth } from '../../../../lib/accounts';
import { isBenefitWalletInstitution } from '../../../../lib/walletAccountLabels';
import type { Account, FinanceData } from '../../../../lib/types/finance';
import { resolveBankThemeClass } from '../../../../lib/walletTheme';
import { creditCardDueAmount } from '../../domain/walletSummaryStats';
import { walletDisplayCashBalance } from '../../domain/walletCashBalance';
import { buildPlasticMotorPayload, type PlasticSlot } from '../../wallet/walletPlasticProps';

type Props = {
    card: Account;
    institution?: Account | null;
    data: FinanceData;
    year: number;
    monthIndex: number;
    currency: string;
    /** Conta corrente / poupança — visual de débito com saldo. */
    variant?: 'card' | 'account';
    forceSlot?: PlasticSlot;
};

function plasticSlotForAccount(
    card: Account,
    institution?: Account | null
): { slot: PlasticSlot; walletMode: 'bank' | 'benefit' } {
    const instType = institution?.type ?? '';
    const raw = walletPlasticSlotForCardType(card.type, String(instType));
    const slot: PlasticSlot =
        raw === 'credit' || raw === 'debit' || raw === 'food' || raw === 'meal' ? raw : 'debit';
    const walletMode =
        isBenefitWalletInstitution(instType) || card.type === 'vale_alimentacao' || card.type === 'vale_refeicao'
            ? 'benefit'
            : 'bank';
    return { slot, walletMode };
}

export function WalletCatalogPlastic({
    card,
    institution,
    data,
    year,
    monthIndex,
    currency,
    variant = 'card',
    forceSlot
}: Props) {
    const html = useMemo(() => {
        const bank =
            institution ??
            (card.linkedAccountId ? data.userAccounts.find((a) => a.id === card.linkedAccountId) : null);
        const themeClass = resolveBankThemeClass(bank?.name ?? card.name);
        const resolved = plasticSlotForAccount(card, bank);
        const slot = forceSlot ?? resolved.slot;
        const walletMode = resolved.walletMode;
        const isCredit = slot === 'credit';
        const isAccount = variant === 'account';

        const amount = isAccount
            ? walletDisplayCashBalance(data, card, { year, monthIndex })
            : isCredit
              ? creditCardDueAmount(card, data, year, monthIndex)
              : sumCardSpendInMonth(card.id, data.userExpenses, year, monthIndex);

        const dueText = isAccount
            ? 'Saldo em conta'
            : isCredit && card.dueDay != null
              ? `Vence dia ${card.dueDay}`
              : '';

        const isCofrinho = String(card.type) === 'cofrinho';
        const plastic = buildPlasticMotorPayload(card, slot, {
            bankAccount: bank ?? card,
            walletMode,
            themeClass,
            displayName: card.name,
            amountText: formatBRL(amount, currency),
            dueText
        });
        const kindLabel = isAccount ? (isCofrinho ? 'Cofrinho' : 'Conta') : undefined;
        return buildWalletPlasticHtml({ ...plastic, slot, walletMode, kindLabel });
    }, [card, institution, data, year, monthIndex, currency, variant, forceSlot]);

    return (
        <div
            className="wallet-card-catalog__plastic-host wallet-account-cards wallet-account-cards--legacy"
            dangerouslySetInnerHTML={{ __html: html }}
        />
    );
}