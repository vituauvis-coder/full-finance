import { useDebtsRequestNewDebt } from '../../context/DebtsHeaderSlotContext';

type Props = { hidden?: boolean };

export function DebtsHeaderActions({ hidden }: Props) {
    const requestNew = useDebtsRequestNewDebt();
    if (hidden) return null;

    return (
        <div
            id="debts-header-actions"
            className="page-toolbar header-page-actions"
            data-toolbar-accent="debts"
            aria-label="Ações de dívidas"
        >
            <div className="page-toolbar__tools">
                <button
                    type="button"
                    id="add-debt-update-btn"
                    className="page-toolbar__cta btn-primary header-action-btn"
                    aria-label="Nova dívida"
                    onClick={(e) => {
                        e.stopPropagation();
                        requestNew();
                    }}
                >
                    <i className="fas fa-plus" aria-hidden="true"></i>
                    <span>Nova</span>
                </button>
            </div>
        </div>
    );
}