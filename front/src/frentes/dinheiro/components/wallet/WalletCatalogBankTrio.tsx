import { useMemo } from 'react';
import { buildWalletPlasticPlaceholderHtml } from '@motor/dinheiro/wallet-plastic.js';
import { resolvePlasticColors } from '@legacy/js/features/finance/account-plastic-appearance.js';
import type { Account, FinanceData } from '../../../../lib/types/finance';
import type { WalletInstitutionRowModel } from '../../domain/walletInstitutions';
import { WalletCatalogPlastic } from './WalletCatalogPlastic';

type Props = {
    row: Extract<WalletInstitutionRowModel, { kind: 'bank' }>;
    data: FinanceData;
    year: number;
    monthIndex: number;
    currency: string;
    themeClass: string;
    creditAmount: (card: Account) => number;
};

function linkedCofrinho(bankId: string, accounts: Account[]): Account | null {
    return (
        accounts.find(
            (a) =>
                String(a.type) === 'cofrinho' && String(a.linkedAccountId ?? '').trim() === String(bankId).trim()
        ) ?? null
    );
}

function PlasticPlaceholder({ html }: { html: string }) {
    return (
        <div
            className="wallet-card-catalog__plastic-host wallet-account-cards wallet-account-cards--legacy"
            dangerouslySetInnerHTML={{ __html: html }}
        />
    );
}

/** Três plásticos horizontais: conta · crédito · cofrinho. */
export function WalletCatalogBankTrio({ row, data, year, monthIndex, currency }: Props) {
    const bank = row.bank;
    const debitCard = row.debitCards[0] ?? null;
    const contaCard = debitCard ?? bank;
    const creditCard = row.creditCards[0] ?? null;
    const cofrinho = linkedCofrinho(bank.id, data.userAccounts);

    const institutionColors = useMemo(() => resolvePlasticColors(bank, null), [bank]);

    const creditPlaceholder = useMemo(
        () =>
            buildWalletPlasticPlaceholderHtml('credit', bank.id, {
                walletMode: 'bank',
                institutionColors
            }),
        [bank.id, institutionColors]
    );

    const cofrinhoPlaceholder = useMemo(
        () => `<div class="wallet-plastics"><div class="wallet-plastic wallet-plastic--placeholder wallet-plastic--debit wallet-plastic--inactive" aria-hidden="true">
        <span class="wallet-plastic__top"><span class="wallet-plastic__kind">Cofrinho</span></span>
        <span class="wallet-plastic__name">Reserva</span>
        <span class="wallet-plastic__quiet">Sem cofrinho</span>
    </div></div>`,
        []
    );

    return (
        <>
            <WalletCatalogPlastic
                card={contaCard}
                institution={bank}
                data={data}
                year={year}
                monthIndex={monthIndex}
                currency={currency}
                variant="account"
                forceSlot="debit"
            />
            {creditCard ? (
                <WalletCatalogPlastic
                    card={creditCard}
                    institution={bank}
                    data={data}
                    year={year}
                    monthIndex={monthIndex}
                    currency={currency}
                />
            ) : (
                <PlasticPlaceholder html={`<div class="wallet-plastics">${creditPlaceholder}</div>`} />
            )}
            {cofrinho ? (
                <WalletCatalogPlastic
                    card={cofrinho}
                    institution={bank}
                    data={data}
                    year={year}
                    monthIndex={monthIndex}
                    currency={currency}
                    variant="account"
                    forceSlot="debit"
                />
            ) : (
                <PlasticPlaceholder html={cofrinhoPlaceholder} />
            )}
        </>
    );
}