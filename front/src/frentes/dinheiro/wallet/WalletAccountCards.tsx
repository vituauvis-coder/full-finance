import { useMemo } from 'react';
import { buildWalletAccountCardsHtml } from '@motor/dinheiro/wallet-plastic.js';
import { formatBRL } from '../../../lib/format';
import type { Account } from '../../../lib/types/finance';
import { resolvePlasticColors } from '@legacy/js/features/finance/account-plastic-appearance.js';
import { buildPlasticMotorPayload } from './walletPlasticProps';

type Props = {
    bankId: string | null;
    bankAccount?: Account | null;
    plasticDisplayName?: string;
    walletMode?: 'bank' | 'benefit';
    creditAccounts: Account[];
    debitAccounts: Account[];
    themeClass?: string;
    currency: string;
    creditAmountForCard: (cardId: string) => number;
    benefitAmountForCard?: (cardId: string) => number;
};

/** Plásticos via motor — mesma lógica de cor e rótulos que `loadWalletPage`. */
export function WalletAccountCards({
    bankId,
    bankAccount = null,
    plasticDisplayName = '',
    walletMode = 'bank',
    creditAccounts,
    debitAccounts,
    themeClass = '',
    currency,
    creditAmountForCard,
    benefitAmountForCard
}: Props) {
    const displayName = plasticDisplayName || bankAccount?.name || '';
    const slot1 = walletMode === 'benefit' ? ('food' as const) : ('credit' as const);
    const slot2 = walletMode === 'benefit' ? ('meal' as const) : ('debit' as const);

    const creditPlastics = useMemo(
        () =>
            creditAccounts.map((a) =>
                buildPlasticMotorPayload(a, slot1, {
                    bankAccount,
                    walletMode,
                    themeClass,
                    displayName,
                    amountText:
                        walletMode === 'benefit'
                            ? formatBRL(benefitAmountForCard?.(a.id) ?? 0, currency)
                            : formatBRL(creditAmountForCard(a.id), currency),
                    dueText: walletMode === 'benefit' ? '' : a.dueDay != null ? `Vence dia ${a.dueDay}` : '',
                })
            ),
        [
            creditAccounts,
            bankAccount,
            walletMode,
            themeClass,
            displayName,
            currency,
            creditAmountForCard,
            benefitAmountForCard,
            slot1
        ]
    );

    const debitPlastics = useMemo(
        () =>
            debitAccounts.map((a) =>
                buildPlasticMotorPayload(a, slot2, {
                    bankAccount,
                    walletMode,
                    themeClass,
                    displayName,
                    amountText:
                        walletMode === 'benefit'
                            ? formatBRL(benefitAmountForCard?.(a.id) ?? 0, currency)
                            : undefined
                })
            ),
        [debitAccounts, bankAccount, walletMode, themeClass, displayName, currency, benefitAmountForCard, slot2]
    );

    const institutionColors = useMemo(
        () => (bankAccount ? resolvePlasticColors(bankAccount, null) : null),
        [bankAccount]
    );

    const html = buildWalletAccountCardsHtml({
        bankId: bankId ?? undefined,
        walletMode,
        creditPlastics,
        debitPlastics,
        institutionColors
    });

    return <div className="wallet-account-cards wallet-account-cards--legacy" dangerouslySetInnerHTML={{ __html: html }} />;
}