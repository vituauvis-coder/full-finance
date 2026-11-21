import { useZeroBudgetRequestNewBlock } from '../context/ZeroBudgetHeaderSlotContext';

type Props = { hidden?: boolean };

export function ZeroBudgetHeaderActions({ hidden }: Props) {
    const requestNewBlock = useZeroBudgetRequestNewBlock();
    if (hidden) return null;

    return (
        <div
            id="zero-budget-header-actions"
            className="page-toolbar header-page-actions"
            data-toolbar-accent="zero-budget"
            aria-label="Ações do planejamento"
        >
            <div className="page-toolbar__tools">
                <button
                    type="button"
                    id="add-zero-budget-block-btn"
                    className="page-toolbar__cta btn-primary header-action-btn"
                    aria-label="Novo bloco"
                    onClick={(e) => {
                        e.stopPropagation();
                        requestNewBlock();
                    }}
                >
                    <i className="fas fa-plus" aria-hidden="true"></i>
                    <span>Novo</span>
                </button>
            </div>
        </div>
    );
}