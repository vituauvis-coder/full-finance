import { buildWalletAccountCardsHtml } from '@motor/dinheiro/wallet-plastic.js';
import type { Account } from '../../../lib/types/finance';

type Props = {
    bankId: string;
    walletMode?: 'bank' | 'benefit';
    creditAccounts: Account[];
    debitAccounts: Account[];
};

/** Renderiza coluna de plásticos (HTML motor) para paridade visual com o legado. */
export function WalletAccountCards({ bankId, walletMode = 'bank', creditAccounts, debitAccounts }: Props) {
    const creditPlastics = creditAccounts.map((a) => ({
        id: a.id,
        name: a.name,
        slot: 'credit',
        walletMode,
        amountText: a.balance != null ? String(a.balance) : '',
        kindLabel: 'Crédito'
    }));
    const debitPlastics = debitAccounts.map((a) => ({
        id: a.id,
        name: a.name,
        slot: 'debit',
        walletMode,
        kindLabel: 'Débito'
    }));

    const html = buildWalletAccountCardsHtml({
        bankId,
        walletMode,
        creditPlastics,
        debitPlastics
    });

    return <div className="wallet-account-cards" dangerouslySetInnerHTML={{ __html: html }} />;
}