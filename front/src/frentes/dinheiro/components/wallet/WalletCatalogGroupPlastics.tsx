import { WalletAccountCards } from '../../wallet/WalletAccountCards';
import { sumCardSpendInMonth } from '../../../../lib/accounts';
import type { Account, FinanceData } from '../../../../lib/types/finance';
import type { WalletInstitutionRowModel } from '../../domain/walletInstitutions';
import { WalletCatalogBankTrio } from './WalletCatalogBankTrio';
import { WalletCatalogPlastic } from './WalletCatalogPlastic';

type Props = {
    row: WalletInstitutionRowModel;
    data: FinanceData;
    year: number;
    monthIndex: number;
    currency: string;
    themeClass: string;
    creditAmount: (card: Account) => number;
};

export function WalletCatalogGroupPlastics({
    row,
    data,
    year,
    monthIndex,
    currency,
    themeClass,
    creditAmount
}: Props) {
    const amountForCardId = (cardId: string) => {
        const card = data.userAccounts.find((a) => a.id === cardId);
        return card ? creditAmount(card) : 0;
    };

    if (row.kind === 'bank' && row.walletMode === 'bank') {
        return (
            <div className="wallet-card-catalog__plastics-stack wallet-card-catalog__plastics-stack--trio wallet-plastics--catalog-trio">
                <WalletCatalogBankTrio
                    row={row}
                    data={data}
                    year={year}
                    monthIndex={monthIndex}
                    currency={currency}
                    themeClass={themeClass}
                    creditAmount={creditAmount}
                />
            </div>
        );
    }

    if (row.kind === 'bank') {
        return (
            <div className="wallet-card-catalog__plastics-stack">
                <WalletAccountCards
                    bankId={row.bank.id}
                    bankAccount={row.bank}
                    plasticDisplayName={row.bank.name}
                    walletMode={row.walletMode}
                    creditAccounts={row.creditCards}
                    debitAccounts={row.debitCards}
                    themeClass={themeClass}
                    creditAmountForCard={amountForCardId}
                    benefitAmountForCard={(id) =>
                        sumCardSpendInMonth(id, data.userExpenses, year, monthIndex)
                    }
                    currency={currency}
                />
            </div>
        );
    }

    const card = row.card;
    if (String(card.type) === 'cofrinho') {
        return (
            <WalletCatalogPlastic
                card={card}
                data={data}
                year={year}
                monthIndex={monthIndex}
                currency={currency}
                variant="account"
                forceSlot="debit"
            />
        );
    }

    const isCredit = row.kind === 'orphan-credit';
    const isBenefit = row.kind === 'orphan-benefit';
    const benefitSlot = isBenefit ? row.benefitSlot ?? 'food' : null;

    return (
        <WalletAccountCards
            bankId={null}
            walletMode={isBenefit ? 'benefit' : 'bank'}
            creditAccounts={isCredit || benefitSlot === 'food' ? [card] : []}
            debitAccounts={row.kind === 'orphan-debit' || benefitSlot === 'meal' ? [card] : []}
            themeClass={themeClass}
            creditAmountForCard={amountForCardId}
            benefitAmountForCard={(id) => sumCardSpendInMonth(id, data.userExpenses, year, monthIndex)}
            currency={currency}
        />
    );
}