import { useWalletRequestNewAccount } from '../context/WalletHeaderSlotContext';

type Props = { hidden?: boolean };

export function WalletHeaderActions({ hidden }: Props) {
    const requestNewAccount = useWalletRequestNewAccount();
    if (hidden) return null;

    return (
        <div
            id="wallet-header-actions"
            className="page-toolbar header-page-actions"
            data-toolbar-accent="wallet"
            aria-label="Ações da carteira"
        >
            <div className="page-toolbar__tools">
                <button
                    type="button"
                    id="wallet-new-account-btn"
                    className="page-toolbar__cta btn-primary header-action-btn"
                    aria-label="Nova"
                    onClick={(e) => {
                        e.stopPropagation();
                        requestNewAccount();
                    }}
                >
                    <i className="fas fa-plus" aria-hidden="true" />
                    <span>Nova</span>
                </button>
            </div>
        </div>
    );
}