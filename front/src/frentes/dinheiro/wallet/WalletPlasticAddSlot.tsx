type Props = {
    slot: 'credit' | 'debit';
    walletMode?: 'bank' | 'benefit';
    onAdd: () => void;
    disabled?: boolean;
};

const LABELS = {
    bank: { credit: 'Crédito', debit: 'Débito' },
    benefit: { credit: 'Alimentação', debit: 'Refeição' }
} as const;

export function WalletPlasticAddSlot({ slot, walletMode = 'bank', onAdd, disabled }: Props) {
    const mode = walletMode === 'benefit' ? 'benefit' : 'bank';
    const kind = slot === 'credit' ? LABELS[mode].credit : LABELS[mode].debit;

    return (
        <button
            type="button"
            className={`wallet-mini-card wallet-mini-card--add wallet-mini-card--${slot}`}
            onClick={onAdd}
            disabled={disabled}
            aria-label={`Adicionar ${kind.toLowerCase()}`}
        >
            <span className="wallet-mini-card__top">
                <span className="wallet-mini-card__kind">{kind}</span>
                <span className="wallet-mini-card__add" aria-hidden="true">
                    +
                </span>
            </span>
            <span className="wallet-mini-card__title">Adicionar cartão</span>
            <span className="wallet-mini-card__hint">Toque para cadastrar</span>
        </button>
    );
}