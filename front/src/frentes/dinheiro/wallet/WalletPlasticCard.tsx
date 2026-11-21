import { formatBRL } from '../../../lib/format';
import type { Account } from '../../../lib/types/finance';

type Props = {
    account: Account;
    slot: 'credit' | 'debit';
    themeClass: string;
    currency: string;
    amount?: number;
    onOpen: (cardId: string) => void;
};

export function WalletPlasticCard({ account, slot, themeClass, currency, amount, onOpen }: Props) {
    const isCredit = slot === 'credit';
    const due = isCredit && account.dueDay != null ? `Dia ${account.dueDay}` : null;

    return (
        <button
            type="button"
            className={[
                'wallet-mini-card',
                `wallet-mini-card--${slot}`,
                themeClass,
                'wallet-card-open'
            ]
                .filter(Boolean)
                .join(' ')}
            data-card-id={account.id}
            onClick={() => onOpen(account.id)}
            aria-label={`Ver lançamentos do cartão ${account.name}`}
        >
            <span className="wallet-mini-card__top">
                <span className="wallet-mini-card__kind">{isCredit ? 'Crédito' : 'Débito'}</span>
                {due ? <span className="wallet-mini-card__meta">{due}</span> : null}
            </span>
            <span className="wallet-mini-card__title">{account.name}</span>
            {isCredit ? (
                <span className="wallet-mini-card__amount">{formatBRL(amount ?? 0, currency)}</span>
            ) : (
                <span className="wallet-mini-card__muted">Sem fatura</span>
            )}
        </button>
    );
}