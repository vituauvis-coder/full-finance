import { accountHolderDisplayLabel, accountTypeDisplayLabel } from '../../../../lib/walletAccountLabels';
import { formatBRL } from '../../../../lib/format';
import type { Account } from '../../../../lib/types/finance';
import { WalletAccountCards } from '../../wallet/WalletAccountCards';
import type { WalletInstitutionRowModel } from '../../domain/walletInstitutions';
import { WalletInstitutionRowActions } from './WalletInstitutionRowActions';
import { institutionStripStyle } from '../../wallet/walletInstitutionStrip';

type RowActions = {
    onEditBank: (bank: Account) => void;
    onDeleteBank: (bank: Account) => void;
    currency: string;
};

type Props = {
    row: WalletInstitutionRowModel;
    actions: RowActions;
    plasticAmountForCredit: (cardId: string) => number;
    plasticAmountForBenefit?: (cardId: string) => number;
};

export function WalletInstitutionRow({ row, actions, plasticAmountForCredit, plasticAmountForBenefit }: Props) {
    const tintClass = `wallet-institution-row--tint-${row.tint % 5}`;
    const themeClass = row.kind === 'bank' ? row.themeClass : row.themeClass;

    if (row.kind === 'bank') {
        const bank = row.bank;
        const holder = accountHolderDisplayLabel(bank);
        const balance = Number(bank.balance) || 0;
        const stripStyle = institutionStripStyle(bank, row.themeClass);

        return (
            <article
                className={`wallet-institution-row ${tintClass}${themeClass ? ` ${themeClass}` : ''}`}
                data-has-account="1"
                data-has-cards={row.creditCards.length + row.debitCards.length > 0 ? '1' : '0'}
            >
                <div className="wallet-institution-row__strip" aria-hidden="true" style={stripStyle} />
                <div className="wallet-institution-row__bank">
                    <h3>{bank.name}</h3>
                    <span className="wallet-institution-row__meta">{accountTypeDisplayLabel(bank.type)}</span>
                    {holder ? <span className="wallet-institution-row__holder">{holder}</span> : null}
                </div>
                <div className="wallet-institution-row__account">
                    <div className="wallet-institution-row__label">Saldo</div>
                    <div className="wallet-institution-row__amount">{formatBRL(balance, actions.currency)}</div>
                </div>
                <div className="wallet-institution-row__cards">
                    <WalletAccountCards
                        bankId={bank.id}
                        bankAccount={bank}
                        plasticDisplayName={bank.name}
                        walletMode={row.walletMode}
                        creditAccounts={row.creditCards}
                        debitAccounts={row.debitCards}
                        themeClass={row.themeClass}
                        creditAmountForCard={plasticAmountForCredit}
                        benefitAmountForCard={plasticAmountForBenefit}
                        currency={actions.currency}
                    />
                </div>
                <WalletInstitutionRowActions
                    bank={bank}
                    onEdit={actions.onEditBank}
                    onDelete={actions.onDeleteBank}
                />
            </article>
        );
    }

    const card = row.card;
    const isCredit = row.kind === 'orphan-credit';
    const isBenefit = row.kind === 'orphan-benefit';
    const benefitSlot = isBenefit ? row.benefitSlot ?? 'food' : null;
    const stripStyle = institutionStripStyle(null, row.themeClass);
    const orphanMeta = isBenefit ? 'Vale (sem conta vinculada)' : 'Cartão (sem conta vinculada)';
    const orphanWalletMode = isBenefit ? 'benefit' : 'bank';

    return (
        <article
            className={`wallet-institution-row ${tintClass}${themeClass ? ` ${themeClass}` : ''}`}
            data-has-account="0"
            data-has-cards="1"
        >
            <div className="wallet-institution-row__strip" aria-hidden="true" style={stripStyle} />
            <div className="wallet-institution-row__bank">
                <h3>{card.name}</h3>
                <span className="wallet-institution-row__meta">{orphanMeta}</span>
            </div>
            <div className="wallet-institution-row__account">
                <div className="wallet-institution-row__empty">
                    <i className="fas fa-lock" aria-hidden="true" /> Sem conta atrelada
                </div>
            </div>
            <div className="wallet-institution-row__cards">
                <WalletAccountCards
                    bankId={null}
                    walletMode={orphanWalletMode}
                    creditAccounts={isCredit || benefitSlot === 'food' ? [card] : []}
                    debitAccounts={row.kind === 'orphan-debit' || benefitSlot === 'meal' ? [card] : []}
                    themeClass={row.themeClass}
                    creditAmountForCard={plasticAmountForCredit}
                    benefitAmountForCard={plasticAmountForBenefit}
                    currency={actions.currency}
                />
            </div>
            <div className="wallet-institution-row__row-actions" />
        </article>
    );
}