import { useMemo } from 'react';
import { MaterialIcon } from '../../../../components/icons/MaterialIcon';
import type { Account, FinanceData } from '../../../../lib/types/finance';
import { MONTH_NAMES } from '../../../../lib/period';
import { creditCardDueAmount } from '../../domain/walletSummaryStats';
import { buildWalletCatalogGroups } from '../../domain/walletCatalogGroups';
import { WalletCatalogGroupRow } from './WalletCatalogGroupRow';

type Props = {
    data: FinanceData;
    year: number;
    monthIndex: number;
    currency: string;
    onEdit: (account: Account) => void;
    /** Clique nos plásticos é delegado via `useWalletInstitutionListClicks`. */
    onPlasticOpen?: (cardId: string) => void;
};

export function WalletCardCatalog({ data, year, monthIndex, currency, onEdit }: Props) {
    const monthLbl = `${MONTH_NAMES[monthIndex]}/${String(year).slice(-2)}`;

    const creditAmount = (card: Account) => creditCardDueAmount(card, data, year, monthIndex);

    const groups = useMemo(
        () => buildWalletCatalogGroups(data, year, monthIndex, creditAmount),
        [data, year, monthIndex]
    );

    return (
        <section
            id="wallet-card-catalog"
            className="wallet-card-catalog wallet-card-catalog--tiles"
            aria-label="Catálogo de contas e cartões"
        >
            <header className="wallet-card-catalog__head">
                <h2 className="wallet-card-catalog__title">
                    <MaterialIcon name="account_balance_wallet" variant="app" opticalSize={20} />
                    Contas e cartões
                </h2>
            </header>

            <div className="wallet-card-catalog__list" aria-live="polite">
                {groups.length === 0 ? (
                    <p className="wallet-card-catalog__empty">
                        Nada cadastrado ainda. Use <strong>Nova</strong> no topo.
                    </p>
                ) : (
                    groups.map((group) => (
                        <WalletCatalogGroupRow
                            key={group.id}
                            group={group}
                            data={data}
                            year={year}
                            monthIndex={monthIndex}
                            currency={currency}
                            monthLbl={monthLbl}
                            creditAmount={creditAmount}
                            onEdit={onEdit}
                        />
                    ))
                )}
            </div>
        </section>
    );
}