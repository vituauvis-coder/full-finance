import type { Account, FinanceData } from '../../../../lib/types/finance';
import type { WalletCatalogGroup } from '../../domain/walletCatalogGroups';
import { WalletCatalogInstitutionCard } from './WalletCatalogInstitutionCard';

type Props = {
    group: WalletCatalogGroup;
    data: FinanceData;
    year: number;
    monthIndex: number;
    currency: string;
    monthLbl: string;
    creditAmount: (card: Account) => number;
    onEdit: (account: Account) => void;
};

export function WalletCatalogGroupRow({ group, data, year, monthIndex, currency, monthLbl, onEdit }: Props) {
    return (
        <WalletCatalogInstitutionCard
            group={group}
            data={data}
            year={year}
            monthIndex={monthIndex}
            currency={currency}
            monthLbl={monthLbl}
            onEdit={onEdit}
        />
    );
}